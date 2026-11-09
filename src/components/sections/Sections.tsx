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
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { BLOCK_PALETTE } from '../../paths.js'
import { selectedSiteID, siteWhere } from '../selectedSite.js'
import { SectionsClient, type SectionCard } from './SectionsClient.js'

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
  if (!user) redirect(formatAdminURL({ adminRoute, path: '/login' }))

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

    // Which pages use each section, read as the signed-in user: only the
    // title and the blocks fields, so a big site doesn't load every page whole.
    const titleField = collection.admin?.useAsTitle
    const select: Record<string, true> = { title: true, name: true }
    if (titleField) select[titleField] = true
    for (const { path } of found) select[path[0]] = true
    const where = siteWhere(payload, collection.slug, siteID)
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
        select: Object.fromEntries(Object.keys(select).filter((k) => collection.flattenedFields.some((f) => f.name === k)).map((k) => [k, true])),
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
    >
      <Gutter>
        <SectionsClient sections={[...cards.values()]} />
      </Gutter>
    </DefaultTemplate>
  )
}
