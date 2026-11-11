// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * SEO overview (admin.components.views.seoOverview, path /seo). Tabs:
 * search listings (every page and post's search title, description and
 * whether search engines may list it, edited in place), schema, alt text
 * (every picture in an upload collection with an `alt` field, missing ones
 * first) and redirects.
 * Reads in the language chosen in the menu, without falling back to English,
 * so a missing translation shows as missing.
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'
import { publicPath } from '../../routes.js'
import { selectedSiteID, siteWhere } from '../selectedSite.js'

import { SeoWorkspace, type AltRow, type RedirectRow, type SeoRow } from './SeoTable.js'
import { headerActions } from '../headerActions.js'

export const SeoOverview = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  // Payload signs people out before a view runs, so no user here means the
  // account couldn't be read (the database is busy or restarting). Show
  // Payload's error rather than bouncing through the login page to home.
  if (!user) throw new Error('Your account could not be read just now. Reload the page in a moment.')
  // The collections listed, and where each lives: webheroAdmin({ seo, routes, homeSlug }).
  const { seo, routes, homeSlug, redirectsFrom } = readOptions(payload.config)
  const KINDS = seo.filter((k) => payload.collections[k.slug as 'pages'])

  const defaultCode = payload.config.localization ? payload.config.localization.defaultLocale : 'en'
  const code = locale?.code ?? defaultCode
  // Multi-site: only the site picked in the site menu, like every list.
  const siteID = await selectedSiteID(payload)
  const rows: SeoRow[] = []
  // One query at a time, only the fields the table shows, as the signed-in user.
  for (const kind of KINDS) {
    const where = siteWhere(payload, kind.slug, siteID)
    const { docs } = await payload.find({
      collection: kind.slug as 'pages',
      depth: 0,
      draft: true,
      limit: 500,
      // Every language at once: this language's search text with no fallback,
      // and the page name in English when it isn't translated yet.
      locale: 'all',
      overrideAccess: false,
      pagination: false,
      req,
      select: { title: true, slug: true, path: true, meta: true, noIndex: true, _status: true, updatedAt: true } as any,
      user,
      ...(where ? { where } : {}),
    })
    for (const doc of docs as any[]) {
      const pick = (value: any) => (value && typeof value === 'object' ? value[code] : value) ?? ''
      rows.push({
        id: String(doc.id),
        collection: kind.slug,
        kind: kind.kind,
        title: pick(doc.title) || doc.title?.[defaultCode] || 'Untitled',
        titleTranslated: Boolean(pick(doc.title)),
        // A localized slug or path comes back per language: use this language's, else the main one's.
        path:
          publicPath(routes, homeSlug, kind.slug, {
            slug: pick(doc.slug) || doc.slug?.[defaultCode],
            path: pick(doc.path) || doc.path?.[defaultCode],
          }) ?? '',
        searchTitle: pick(doc.meta?.title),
        description: pick(doc.meta?.description),
        indexed: doc.noIndex !== true,
        // The latest version is a draft: saving here must not publish other edits.
        hasDraft: doc._status !== 'published',
        updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : '',
        editHref: formatAdminURL({ adminRoute, path: `/collections/${kind.slug}/${doc.id}` }),
      })
    }
  }

  // Redirects are for managers (cms/access.ts). Anyone else gets no Redirects tab.
  const redirectWhere = payload.collections['redirects' as 'pages'] ? siteWhere(payload, 'redirects', siteID) : undefined
  const redirectResult = await payload
    .find({
      collection: 'redirects',
      depth: 0,
      limit: 500,
      overrideAccess: false,
      pagination: false,
      req,
      sort: 'from',
      user,
      ...(redirectWhere ? { where: redirectWhere } : {}),
    })
    .catch(() => null)
  const redirects: RedirectRow[] | null =
    redirectResult &&
    (redirectResult.docs as any[]).map((doc) => ({
      id: String(doc.id),
      from: doc.from ?? '',
      toType: doc.to?.type === 'custom' ? 'custom' : 'reference',
      toRef: doc.to?.reference ? `${doc.to.reference.relationTo}:${doc.to.reference.value}` : '',
      toUrl: doc.to?.url ?? '',
      type: doc.type === '302' ? '302' : '301',
    }))

  // Alt text: pictures in every upload collection with a top-level `alt` field
  // that this person may edit. Same language as the rest of the page.
  const altCollections = payload.config.collections.filter(
    (c) =>
      c.upload &&
      permissions?.collections?.[c.slug]?.update &&
      c.fields.some((f) => 'name' in f && f.name === 'alt' && (f.type === 'text' || f.type === 'textarea')),
  )
  const altRows: AltRow[] = []
  for (const c of altCollections) {
    const where = siteWhere(payload, c.slug, siteID)
    const imageOnly = { mimeType: { like: 'image/' } }
    const result = await payload
      .find({
        collection: c.slug as 'pages',
        depth: 0,
        limit: 1000,
        ...(payload.config.localization ? { locale: code, fallbackLocale: false as any } : {}),
        overrideAccess: false,
        pagination: false,
        req,
        select: { filename: true, alt: true, mimeType: true, url: true, thumbnailURL: true, sizes: true } as any,
        sort: '-createdAt',
        user,
        where: where ? { and: [where, imageOnly] } : imageOnly,
      })
      .catch(() => null)
    for (const doc of (result?.docs ?? []) as any[]) {
      const thumb = doc.thumbnailURL || doc.sizes?.thumbnail?.url || doc.url || ''
      altRows.push({
        id: String(doc.id),
        collection: c.slug,
        filename: doc.filename ?? String(doc.id),
        alt: typeof doc.alt === 'string' ? doc.alt : '',
        thumb,
        editHref: formatAdminURL({ adminRoute, path: `/collections/${c.slug}/${doc.id}` }),
      })
    }
  }

  const localeLabel =
    payload.config.localization && locale
      ? payload.config.localization.locales.find((l) => l.code === locale.code)
      : undefined

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
        <SeoWorkspace
          apiRoute={payload.config.routes.api}
          altRows={altCollections.length ? altRows : null}
          initialTab={
            searchParams?.tab === 'redirects' || searchParams?.tab === 'schema' || searchParams?.tab === 'alt'
              ? searchParams.tab
              : 'listings'
          }
          locale={locale?.code}
          localeLabel={typeof localeLabel?.label === 'string' ? localeLabel.label : undefined}
          redirects={redirects}
          redirectsFrom={
            typeof redirectsFrom === 'string' ? redirectsFrom : siteID && redirectsFrom ? redirectsFrom[siteID] : undefined
          }
          rows={rows}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
