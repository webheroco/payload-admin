// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * Performance (admin.components.views.performance, path /performance): the
 * enquiries sent through the website's forms, counted from the real
 * submissions by form type and by the page they were sent from. Follows the
 * Site chosen in the menu.
 *
 * Where it counts from is webheroAdmin({ enquiries }): the skill's one
 * Submissions collection with a form type field (the default), or the Form
 * Builder plugin's `forms` and `form-submissions`.
 */
import type { AdminViewServerProps, PayloadRequest, TypedUser } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'
import { PerformanceClient, type Enquiry } from './PerformanceClient.js'

const PERIODS = [7, 30, 90] as const

export const Performance = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  if (!user) redirect(formatAdminURL({ adminRoute, path: '/login' }))

  const days = PERIODS.find((p) => String(p) === searchParams?.period) ?? 30
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const previousStart = new Date(end.getTime() - days * 2 * 86400000)

  // Multi-site: the Site chosen in the menu (the multi-tenant plugin's
  // cookie); none means all sites. Single-site projects have no tenants.
  const tenantID = payload.collections['tenants' as 'pages'] ? (await cookies()).get('payload-tenant')?.value : undefined
  const tenant = tenantID
    ? ((await payload
        .findByID({ collection: 'tenants' as 'pages', id: tenantID, depth: 0, req })
        .catch(() => null)) as { id: number | string; name?: string } | null)
    : null

  const { enquiries: source } = readOptions(payload.config)
  const enquiries: Enquiry[] =
    'formBuilder' in source
      ? await formBuilderEnquiries({ adminRoute, from: previousStart, req, tenantID: tenant?.id, user })
      : await collectionEnquiries({ adminRoute, from: previousStart, req, source, tenantID: tenant?.id, user })

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
        <PerformanceClient
          days={days}
          periods={[...PERIODS]}
          siteName={tenant?.name ?? 'This site'}
          enquiries={enquiries}
          start={start.toISOString()}
          end={end.toISOString()}
        />
      </Gutter>
    </DefaultTemplate>
  )
}

type Args = { adminRoute: string; from: Date; req: PayloadRequest; user: TypedUser }

/** The name to show for an enquiry: whichever of these the form asked for. */
const NAME_FIELDS = ['full-name', 'fullName', 'name', 'email']

/** The skill's standard: one collection, a select naming the form, the page it came from. */
async function collectionEnquiries({
  adminRoute,
  from,
  req,
  source,
  tenantID,
  user,
}: Args & {
  source: { collection: string; formField: string; pageField?: string }
  tenantID?: number | string
}): Promise<Enquiry[]> {
  const { payload } = req
  if (!payload.collections[source.collection as 'pages']) return []
  const fields = payload.collections[source.collection as 'pages'].config.flattenedFields
  const field = fields.find((f) => f.name === source.formField)
  // Multi-site: only the chosen site's enquiries.
  const bySite = tenantID && fields.some((f) => f.name === 'tenant') ? [{ tenant: { equals: tenantID } }] : []
  // The form's label as the editor sees it, not the stored value ("contact").
  const labels = new Map<string, string>(
    field && 'options' in field
      ? (field.options as (string | { label: unknown; value: string })[]).map((o) =>
          typeof o === 'string' ? [o, o] : [o.value, typeof o.label === 'string' ? o.label : o.value],
        )
      : [],
  )
  const { docs } = await payload.find({
    collection: source.collection as 'pages',
    depth: 0,
    limit: 5000,
    overrideAccess: false,
    pagination: false,
    req,
    sort: '-createdAt',
    user,
    where: { and: [{ createdAt: { greater_than_equal: from.toISOString() } }, ...bySite] },
  })
  return (docs as any[]).map((s) => {
    const form = String(s[source.formField] ?? '')
    return {
      id: String(s.id),
      form: labels.get(form) ?? (form || 'Form'),
      page: (source.pageField && s[source.pageField]) || '—',
      name: NAME_FIELDS.map((n) => s[n]).find((v) => typeof v === 'string' && v) ?? 'Someone',
      at: s.createdAt,
      href: formatAdminURL({ adminRoute, path: `/collections/${source.collection}/${s.id}` }),
    }
  })
}

/** The Form Builder plugin: form titles from `forms`, answers in `submissionData`. */
async function formBuilderEnquiries({
  adminRoute,
  from,
  req,
  tenantID,
  user,
}: Args & { tenantID?: number | string }): Promise<Enquiry[]> {
  const { payload } = req
  const { docs: forms } = await payload.find({
    collection: 'forms' as 'pages',
    depth: 0,
    limit: 200,
    pagination: false,
    req,
    select: { title: true },
    ...(tenantID ? { where: { tenant: { equals: tenantID } } } : {}),
  })
  const formTitle = new Map((forms as any[]).map((f) => [String(f.id), f.title as string]))

  const { docs: submissions } = await payload.find({
    collection: 'form-submissions' as 'pages',
    depth: 0,
    limit: 5000,
    overrideAccess: false,
    pagination: false,
    req,
    sort: '-createdAt',
    user,
    where: {
      and: [
        { createdAt: { greater_than_equal: from.toISOString() } },
        { form: { in: (forms as any[]).map((f) => f.id) } },
      ],
    },
  })

  return (submissions as any[]).map((s) => {
    const data = new Map<string, string>((s.submissionData ?? []).map((d: any) => [d.field, String(d.value)]))
    return {
      id: String(s.id),
      form: formTitle.get(String(typeof s.form === 'object' ? s.form.id : s.form)) ?? 'Form',
      page: s.page || '—',
      name: NAME_FIELDS.map((n) => data.get(n)).find(Boolean) ?? 'Someone',
      at: s.createdAt,
      href: formatAdminURL({ adminRoute, path: `/collections/form-submissions/${s.id}` }),
    }
  })
}
