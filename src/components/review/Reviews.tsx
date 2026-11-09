// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * Reviews (admin.components.views.reviews, path /reviews), added when
 * approvals are on: everything going through sign-off, as a list or a board
 * with a column per stage. Approvers see everyone's; editors see their own.
 * Opening a row goes to the document, where the review buttons are.
 */
import type { AdminViewServerProps, CollectionSlug, Where } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { adminPath, hasDrafts, REVIEWS_SLUG, typeLabel, type ReviewStatus } from '../../approvals.js'
import { canApprove, readOptions } from '../../options.js'
import { ReviewsClient, type ReviewItem } from './ReviewsClient.js'

const DAY = 86_400_000

type Person = { id: number | string; name?: string | null; email?: string | null }
type Row = {
  id: number | string
  kind: 'collection' | 'global'
  entity: string
  docId?: string | null
  locale?: string | null
  status: ReviewStatus
  title?: string | null
  note?: string | null
  publishAt?: string | null
  createdAt: string
  reviewedAt?: string | null
  submittedBy?: Person | number | string | null
  reviewedBy?: Person | number | string | null
}

export const Reviews = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  if (!user) redirect(formatAdminURL({ adminRoute, path: '/login' }))
  const { approvals } = readOptions(payload.config)
  if (!approvals) redirect(adminRoute)
  const approver = canApprove(user, approvals)
  const usersSlug = (payload.config.admin.user ?? 'users') as CollectionSlug

  const base: Where[] = [{ status: { not_equals: 'replaced' } }]
  if (!approver) base.push({ submittedBy: { equals: user!.id } })
  const result = await payload
    .find({
      collection: REVIEWS_SLUG as CollectionSlug,
      // Open requests, and 90 days of history.
      where: { and: [...base, { or: [{ status: { in: ['waiting', 'sentBack', 'scheduled'] } }, { createdAt: { greater_than_equal: new Date(Date.now() - 90 * DAY).toISOString() } }] }] },
      sort: '-createdAt',
      depth: 0,
      limit: 1000,
      pagination: false,
      req,
      user,
      overrideAccess: false,
    })
    .catch(() => ({ docs: [] }))
  const rows = result.docs as unknown as Row[]

  // Names only, looked up as the system: editors can't read other accounts.
  const ids = [...new Set(rows.flatMap((r) => [r.submittedBy, r.reviewedBy]).filter((p): p is number | string => typeof p === 'number' || typeof p === 'string'))]
  const people = ids.length
    ? await payload
        .find({ collection: usersSlug, where: { id: { in: ids } }, depth: 0, limit: ids.length, pagination: false, overrideAccess: true })
        .then((r) => new Map((r.docs as unknown as Person[]).map((u) => [String(u.id), u.name || u.email || 'Someone'])))
        .catch(() => new Map<string, string>())
    : new Map<string, string>()
  const nameOf = (p: Row['submittedBy']) => (p === null || p === undefined ? '' : people.get(String(typeof p === 'object' ? p.id : p)) ?? 'Someone')

  const configs = [
    ...payload.config.collections.filter((c) => c.slug !== REVIEWS_SLUG && hasDrafts(c)).map((c) => ({ kind: 'collection' as const, config: c })),
    ...payload.config.globals.filter((g) => hasDrafts(g)).map((g) => ({ kind: 'global' as const, config: g })),
  ].filter(({ config }) => !approvals.only || approvals.only.includes(config.slug))
  const label = (entity: string) => typeLabel(configs.find((c) => c.config.slug === entity)?.config as never, entity)
  const languages = payload.config.localization ? payload.config.localization.locales : []
  const languageName = (code?: string | null) => {
    const found = languages.find((l) => l.code === code)
    return found ? (typeof found.label === 'string' ? found.label : code ?? '') : ''
  }

  const items: ReviewItem[] = rows.map((r) => ({
    id: String(r.id),
    key: `${r.entity}:${r.docId ?? ''}:${r.locale ?? ''}`,
    status: r.status,
    title: r.title || 'Untitled',
    type: label(r.entity),
    entity: r.entity,
    language: languageName(r.locale),
    from: nameOf(r.submittedBy),
    reviewer: nameOf(r.reviewedBy),
    note: r.note ?? '',
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt ?? null,
    publishAt: r.publishAt ?? null,
    href: adminPath(adminRoute, r),
  }))

  // The board's first column: documents with unpublished changes nobody has submitted yet.
  const code = locale?.code
  const drafts = (
    await Promise.all(
      configs
        .filter((c) => c.kind === 'collection')
        .map(({ config }) =>
          payload
            .find({
              collection: config.slug as CollectionSlug,
              draft: true,
              where: { _status: { equals: 'draft' } },
              sort: '-updatedAt',
              depth: 0,
              limit: 8,
              req,
              user,
              overrideAccess: false,
              ...(code ? { locale: code as never } : {}),
            })
            .then((r) =>
              (r.docs as unknown as Record<string, unknown>[]).map((d) => {
                const titleField = (config.admin as { useAsTitle?: string } | undefined)?.useAsTitle
                const raw = (titleField && d[titleField]) || d.title || d.name
                return {
                  key: `${config.slug}:${String(d.id)}:${code ?? ''}`,
                  title: typeof raw === 'string' && raw ? raw : 'Untitled',
                  type: label(config.slug),
                  entity: config.slug,
                  updatedAt: String(d.updatedAt ?? ''),
                  href: adminPath(adminRoute, { kind: 'collection', entity: config.slug, docId: String(d.id), locale: code }),
                }
              }),
            )
            .catch(() => []),
        ),
    )
  )
    .flat()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

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
        <ReviewsClient
          apiRoute={payload.config.routes.api}
          approver={approver}
          drafts={drafts}
          initialView={searchParams?.view === 'board' ? 'board' : 'list'}
          items={items}
          showLanguage={languages.length > 1}
          types={configs.map(({ config }) => ({ value: config.slug, label: label(config.slug) }))}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
