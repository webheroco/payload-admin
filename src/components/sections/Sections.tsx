// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * Sections (admin.components.views.sections, path /sections): every section
 * (block) the site has, with its picture, what it is for and the pages that
 * use it. Read only: sections are built in code, and editors add, reorder
 * and fill them on any page. This page answers "what can I use, and where
 * is it already?".
 */
import type { AdminViewServerProps, CollectionSlug } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { BLOCK_PALETTE } from '../../paths.js'
import { sectionUsage, usagePlan } from '../../sections-usage.js'
import { selectedSiteID, siteWhere } from '../selectedSite.js'
import { SectionsClient, type SectionCard } from './SectionsClient.js'
import { headerActions } from '../headerActions.js'

type AnyField = Record<string, any>

const labelOf = (labels: unknown, fallback: string): string => {
  if (typeof labels === 'string') return labels
  if (labels && typeof labels === 'object') return String((labels as Record<string, unknown>).en ?? Object.values(labels)[0] ?? fallback)
  return fallback
}

/** Blocks fields with the data path to them, and any section palette's descriptions. */
function walk(fields: AnyField[] | undefined, prefix: string[], found: { path: string[]; field: AnyField }[], descriptions: Record<string, string>) {
  for (const field of fields ?? []) {
    if (!field) continue
    if (field.type === 'blocks') found.push({ path: [...prefix, field.name], field })
    if (field.type === 'ui') {
      const c = field.admin?.components?.Field
      if (c && typeof c === 'object' && c.path === BLOCK_PALETTE) Object.assign(descriptions, c.clientProps?.descriptions ?? {})
    }
    if (field.type === 'tabs') for (const tab of field.tabs ?? []) walk(tab.fields, tab.name ? [...prefix, tab.name] : prefix, found, descriptions)
    else if (field.type === 'group' && field.name) walk(field.fields, [...prefix, field.name], found, descriptions)
    else if (field.type === 'row' || field.type === 'collapsible' || (field.type === 'group' && !field.name)) walk(field.fields, prefix, found, descriptions)
  }
}

const at = (doc: Record<string, unknown>, path: string[]) => path.reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), doc)

export const Sections = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  // Payload signs people out before a view runs, so no user here means the
  // account couldn't be read (the database is busy or restarting). Show
  // Payload's error rather than bouncing through the login page to home.
  if (!user) throw new Error('Your account could not be read just now. Reload the page in a moment.')

  const library = new Map<string, AnyField>()
  for (const block of (payload.config.blocks ?? []) as AnyField[]) library.set(block.slug, block)
  const cards = new Map<string, SectionCard>()
  const descriptions: Record<string, string> = {}
  // Multi-site: the pages of the site picked in the site menu.
  const siteID = await selectedSiteID(payload)

  for (const collection of payload.config.collections) {
    const found: { path: string[]; field: AnyField }[] = []
    walk(collection.fields as AnyField[], [], found, descriptions)
    if (!found.length) continue
    const blocks = found.flatMap(({ field }) => [
      ...((field.blocks ?? []) as AnyField[]),
      ...((field.blockReferences ?? []) as (string | AnyField)[]).map((b) => (typeof b === 'string' ? library.get(b) : b)).filter(Boolean),
    ]) as AnyField[]
    for (const block of blocks) {
      if (cards.has(block.slug)) continue
      const thumb = block.admin?.images?.thumbnail ?? block.imageURL
      cards.set(block.slug, {
        slug: block.slug,
        label: labelOf(block.labels?.singular, block.slug),
        group: typeof block.admin?.group === 'string' ? block.admin.group : labelOf(block.admin?.group, ''),
        description: '',
        thumbnail: typeof thumb === 'string' ? thumb : thumb?.url,
        pages: [],
      })
    }

    const slugsOf = (field: AnyField) => [
      ...((field.blocks ?? []) as AnyField[]).map((b) => b.slug as string),
      ...((field.blockReferences ?? []) as (string | AnyField)[]).map((b) => (typeof b === 'string' ? b : (b.slug as string))),
    ]
    const titleField = collection.admin?.useAsTitle
    const drafts = Boolean((collection.versions as AnyField | undefined)?.drafts)
    const where = siteWhere(payload, collection.slug, siteID)

    // On Postgres: the page titles on their own (read as the signed-in user,
    // so access and the site menu decide which pages show), then one quick
    // query for which sections those pages hold. Elsewhere, or if the
    // adapter's tables aren't as expected, Payload is asked as before.
    const plan = usagePlan(payload.db, collection.slug, [...new Set(found.flatMap(({ field }) => slugsOf(field)))], drafts)
    if (plan) {
      const select: Record<string, true> = {}
      for (const k of [titleField, 'title', 'name']) if (k && collection.flattenedFields.some((f) => f.name === k)) select[k] = true
      const { docs } = await payload
        .find({
          collection: collection.slug as CollectionSlug,
          depth: 0,
          draft: drafts,
          limit: 0,
          pagination: false,
          req,
          user,
          overrideAccess: false,
          select: select as any,
          ...(where ? { where } : {}),
        })
        .catch(() => ({ docs: [] as unknown[] }))
      const usage = await sectionUsage(
        plan,
        (docs as Record<string, unknown>[]).map((doc) => doc.id as string | number),
      ).catch(() => null)
      // The query failed (a table not as expected): ask Payload, below.
      if (usage) {
        for (const doc of docs as Record<string, unknown>[]) {
          const raw = (titleField && doc[titleField]) || doc.title || doc.name
          const title = typeof raw === 'string' && raw ? raw : 'Untitled'
          for (const slug of usage.get(String(doc.id)) ?? [])
            cards.get(slug)?.pages.push({ title, href: formatAdminURL({ adminRoute, path: `/collections/${collection.slug}/${doc.id}` }) })
        }
        continue
      }
    }

    // Which pages use each section, read as the signed-in user: only the
    // title and the blocks fields, so a big site doesn't load every page whole.
    const select: Record<string, unknown> = { title: true, name: true }
    if (titleField) select[titleField] = true
    // Of each blocks field, only which sections it holds (their type and id),
    // not their text and pictures: on a big site that is most of the database.
    for (const { path, field } of found) {
      const slugs = slugsOf(field)
      let node = select
      path.forEach((key, i) => {
        if (i === path.length - 1) node[key] = Object.fromEntries(slugs.map((slug) => [slug, { id: true }]))
        else node = (node[key] = typeof node[key] === 'object' && node[key] ? node[key] : {}) as Record<string, unknown>
      })
    }
    const { docs } = await payload
      .find({
        collection: collection.slug as CollectionSlug,
        depth: 0,
        draft: true,
        limit: 1000,
        pagination: false,
        req,
        user,
        overrideAccess: false,
        select: Object.fromEntries(Object.entries(select).filter(([k]) => collection.flattenedFields.some((f) => f.name === k))) as any,
        ...(where ? { where } : {}),
      })
      .catch(() => ({ docs: [] as unknown[] }))
    for (const doc of docs as Record<string, unknown>[]) {
      const used = new Set<string>()
      for (const { path } of found) for (const b of (at(doc, path) as AnyField[] | undefined) ?? []) if (b?.blockType) used.add(b.blockType)
      const raw = (titleField && doc[titleField]) || doc.title || doc.name
      const title = typeof raw === 'string' && raw ? raw : 'Untitled'
      for (const slug of used)
        cards.get(slug)?.pages.push({ title, href: formatAdminURL({ adminRoute, path: `/collections/${collection.slug}/${doc.id}` }) })
    }
  }

  for (const card of cards.values()) {
    const block = library.get(card.slug)
    card.description = descriptions[card.slug] ?? (block?.admin?.custom?.description as string | undefined) ?? ''
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
      viewActions={headerActions(payload.config)}
    >
      <Gutter>
        <SectionsClient sections={[...cards.values()]} />
      </Gutter>
    </DefaultTemplate>
  )
}
