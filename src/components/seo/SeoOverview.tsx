// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * SEO overview (admin.components.views.seoOverview, path /seo). Two tabs:
 * search listings (every page and post's search title, description and
 * whether search engines may list it, edited in place) and redirects.
 * Reads in the language chosen in the menu, without falling back to English,
 * so a missing translation shows as missing.
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'
import { publicPath } from '../../routes.js'

import { SeoWorkspace, type RedirectRow, type SeoRow } from './SeoTable.js'

export const SeoOverview = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  if (!user) redirect(formatAdminURL({ adminRoute, path: '/login' }))
  // The collections listed, and where each lives: webheroAdmin({ seo, routes, homeSlug }).
  const { seo, routes, homeSlug } = readOptions(payload.config)
  const KINDS = seo.filter((k) => payload.collections[k.slug as 'pages'])

  const defaultCode = payload.config.localization ? payload.config.localization.defaultLocale : 'en'
  const code = locale?.code ?? defaultCode
  const rows: SeoRow[] = []
  // One query at a time, only the fields the table shows, as the signed-in user.
  for (const kind of KINDS) {
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
      select: { title: true, slug: true, path: true, meta: true, noIndex: true, _status: true } as any,
      user,
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
        editHref: formatAdminURL({ adminRoute, path: `/collections/${kind.slug}/${doc.id}` }),
      })
    }
  }

  // Redirects are for managers (cms/access.ts). Anyone else gets no Redirects tab.
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
    >
      <Gutter>
        <SeoWorkspace
          apiRoute={payload.config.routes.api}
          initialTab={searchParams?.tab === 'redirects' ? 'redirects' : 'listings'}
          locale={locale?.code}
          localeLabel={typeof localeLabel?.label === 'string' ? localeLabel.label : undefined}
          redirects={redirects}
          rows={rows}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
