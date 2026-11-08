/**
 * Approvals: sign-off before anything goes live. Optional, turned on with
 * `webheroAdmin({ approvals: true })`. First built for Quartix.
 *
 *  - Editors keep saving drafts, but their Publish button is "Submit for
 *    review"; the server refuses a publish from anyone who isn't an approver.
 *  - Approvers publish as before, and can schedule or send back a request.
 *  - Publishing from the document closes its open request, and an
 *    approver's own direct publish is recorded, so the Reviews page is the
 *    record of who approved what.
 *  - An editor who changes something already approved for later sends it
 *    back to waiting.
 *  - With translations, a publish by a person (or from a review) publishes
 *    only the language it was made in, never other languages' drafts.
 *
 * Seed, import and scheduler calls run without a signed-in user and are not
 * affected. Scheduled changes go live when `/api/reviews/publish-due` is
 * called (a Vercel cron, with CRON_SECRET).
 */
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
  type CollectionSlug,
  type Config,
  type GlobalAfterChangeHook,
  type GlobalBeforeChangeHook,
  type GlobalBeforeOperationHook,
  type GlobalConfig,
  type GlobalSlug,
  type PayloadRequest,
  type UIField,
  type Where,
} from 'payload'

import { canApprove, type ResolvedApprovals } from './options.js'
import { REVIEW_BANNER, REVIEW_BUTTON } from './paths.js'

export const REVIEWS_SLUG = 'reviews'

export type ReviewTarget = { kind: 'collection' | 'global'; entity: string; docId?: string | null; locale?: string | null }

export const REVIEW_STATUSES = [
  { label: 'Waiting for review', value: 'waiting' },
  { label: 'Sent back', value: 'sentBack' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Published', value: 'published' },
  { label: 'Replaced by a newer request', value: 'replaced' },
] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]['value']
const OPEN: ReviewStatus[] = ['waiting', 'scheduled']

type ReviewDoc = ReviewTarget & {
  id: number | string
  status: ReviewStatus
  title?: string | null
  note?: string | null
  message?: string | null
  publishAt?: string | null
  submittedBy?: unknown
}

export const hasDrafts = (entity: { versions?: unknown }) =>
  typeof entity.versions === 'object' && entity.versions !== null && Boolean((entity.versions as { drafts?: unknown }).drafts)

const localeOf = (req: { locale?: string | null }) => (req.locale && req.locale !== 'all' ? req.locale : null)

const future = (value: unknown) => {
  const at = value ? new Date(String(value)) : null
  if (!at || Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) throw new APIError('Pick a date and time in the future.', 400)
}

/* Targets */

function configOf(req: PayloadRequest, t: ReviewTarget) {
  return t.kind === 'global'
    ? req.payload.config.globals.find((g) => g.slug === t.entity)
    : req.payload.config.collections.find((c) => c.slug === t.entity)
}

/** "Page", "Post", "Footer": what is under review, for the list and emails. */
export function typeLabel(config: { labels?: { singular?: unknown }; label?: unknown; slug: string } | undefined, fallback: string): string {
  const label = config ? ('labels' in config && config.labels ? config.labels.singular : config.label) : undefined
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') return String((label as Record<string, unknown>).en ?? Object.values(label)[0] ?? fallback)
  return fallback
}

export function adminPath(adminRoute: string, t: ReviewTarget) {
  const locale = t.locale ? `?locale=${encodeURIComponent(t.locale)}` : ''
  return t.kind === 'global' ? `${adminRoute}/globals/${t.entity}${locale}` : `${adminRoute}/collections/${t.entity}/${t.docId}${locale}`
}

/** The latest draft's title, read as the system so a review always has a name. */
async function describe(req: PayloadRequest, t: ReviewTarget): Promise<{ title: string } | null> {
  const config = configOf(req, t)
  if (!config) return null
  const label = typeLabel(config as never, t.entity)
  const locale = (t.locale ?? undefined) as never
  try {
    if (t.kind === 'global') {
      await req.payload.findGlobal({ slug: t.entity as GlobalSlug, draft: true, depth: 0, overrideAccess: true, req, locale })
      return { title: label }
    }
    if (!t.docId) return null
    const doc = (await req.payload.findByID({
      collection: t.entity as CollectionSlug,
      id: t.docId,
      draft: true,
      depth: 0,
      overrideAccess: true,
      req,
      locale,
    })) as unknown as Record<string, unknown>
    const titleField = (config as CollectionConfig).admin?.useAsTitle
    const raw = (titleField && doc[titleField]) || doc.title || doc.name
    return { title: typeof raw === 'string' && raw.trim() ? raw.trim() : `Untitled ${label.toLowerCase()}` }
  } catch {
    return null
  }
}

/** Publishes the latest draft, in the review's language only. */
async function publishTarget(req: PayloadRequest, t: ReviewTarget) {
  const locale = t.locale ?? undefined
  const context = { approvalPublish: true }
  if (t.kind === 'global') {
    await req.payload.updateGlobal({ slug: t.entity as GlobalSlug, data: { _status: 'published' } as never, locale: locale as never, publishSpecificLocale: locale, overrideAccess: true, req, context })
    return
  }
  if (!t.docId) throw new Error('This review has no document to publish.')
  await req.payload.update({
    collection: t.entity as CollectionSlug,
    id: t.docId,
    data: { _status: 'published' } as never,
    locale: locale as never,
    publishSpecificLocale: locale,
    overrideAccess: true,
    req,
    context,
  })
}

const sameTarget = (t: ReviewTarget): Where => ({
  and: [
    { kind: { equals: t.kind } },
    { entity: { equals: t.entity } },
    ...(t.kind === 'collection' ? [{ docId: { equals: String(t.docId) } }] : []),
    ...(t.locale ? [{ locale: { equals: t.locale } }] : []),
  ],
})

/* Emails, through Payload's email adapter (Resend on WebHero sites). A failed email never blocks a review. */

type Person = { id: number | string; email?: string | null; name?: string | null }
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function emailLayout(heading: string, lines: string[], button: { label: string; href: string }) {
  const font = '-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
  const body = lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;font-family:${font};color:#151515">${l}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f4">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-family:${font};color:#151515">${heading}</h1>
${body}
<p style="margin:22px 0 0"><a href="${button.href}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#151515;color:#ffffff;font-size:15px;font-weight:600;font-family:${font};text-decoration:none">${button.label}</a></p>
</div></body></html>`
}

const origin = (req: PayloadRequest) => {
  const host = req.headers?.get('host')
  if (host) return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`
  return req.payload.config.serverURL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
}

async function personOf(req: PayloadRequest, value: unknown): Promise<Person | null> {
  if (value && typeof value === 'object' && 'id' in value) return value as Person
  if (typeof value !== 'number' && typeof value !== 'string') return null
  try {
    return (await req.payload.findByID({ collection: (req.payload.config.admin.user ?? 'users') as CollectionSlug, id: value, depth: 0, overrideAccess: true, req })) as unknown as Person
  } catch {
    return null
  }
}

async function send(req: PayloadRequest, to: string[], subject: string, html: string) {
  if (!to.length) return
  try {
    await req.payload.sendEmail({ to, subject, html })
  } catch (err) {
    req.payload.logger.warn(`[reviews] email not sent: ${(err as Error).message}`)
  }
}

const nameOf = (p: Person | null, fallback: string) => p?.name || p?.email || fallback

async function notifySubmitted(req: PayloadRequest, review: ReviewDoc, a: ResolvedApprovals) {
  const author = await personOf(req, review.submittedBy)
  const users = await req.payload.find({
    collection: (req.payload.config.admin.user ?? 'users') as CollectionSlug,
    where: { [a.roleField]: { in: a.approverRoles } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  const to = (users.docs as unknown as Person[]).filter((u) => u.email && u.id !== author?.id).map((u) => u.email as string)
  const lines = [`${escape(nameOf(author, 'Someone'))} submitted <b>${escape(review.title || 'a change')}</b> for review.`]
  if (review.message) lines.push(`Their note: "${escape(review.message)}"`)
  lines.push('You can publish it, schedule it or send it back with a note. Nothing goes live until you do.')
  await send(req, to, `Waiting for your review: ${review.title || 'a change'}`, emailLayout('A change is waiting for your review', lines, { label: 'Review it', href: `${origin(req)}${adminPath(req.payload.config.routes.admin, review)}` }))
}

async function notifyAuthor(req: PayloadRequest, review: ReviewDoc, outcome: 'sentBack' | 'scheduled' | 'published') {
  const author = await personOf(req, review.submittedBy)
  if (!author?.email || author.id === req.user?.id) return
  const by = escape(nameOf(req.user as Person | null, 'An approver'))
  const what = `<b>${escape(review.title || 'Your change')}</b>`
  const href = `${origin(req)}${adminPath(req.payload.config.routes.admin, review)}`
  if (outcome === 'sentBack') {
    await send(req, [author.email], `Sent back: ${review.title || 'your change'}`, emailLayout(`${by} sent your change back`, [`${what} needs another look before it goes live.`, `"${escape(review.note || '')}"`, 'Make the changes, then submit it for review again.'], { label: 'Open it', href }))
    return
  }
  if (outcome === 'scheduled') {
    const at = review.publishAt ? new Date(review.publishAt).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' }) : 'later'
    await send(req, [author.email], `Approved: ${review.title || 'your change'}`, emailLayout(`${by} approved your change`, [`${what} goes live on ${escape(at)} (UK time).`], { label: 'Open it', href }))
    return
  }
  await send(req, [author.email], `Live: ${review.title || 'your change'}`, emailLayout('Your change is live', [`${by} published ${what}.`], { label: 'Open it', href }))
}

/* The Reviews collection */

async function replaceOpen(req: PayloadRequest, t: ReviewTarget, exceptId: number | string) {
  const open = await req.payload.find({ collection: REVIEWS_SLUG as CollectionSlug, where: { and: [sameTarget(t), { status: { in: OPEN } }, { id: { not_equals: exceptId } }] }, depth: 0, limit: 50, overrideAccess: true, req })
  for (const doc of open.docs) await req.payload.update({ collection: REVIEWS_SLUG as CollectionSlug, id: doc.id, data: { status: 'replaced' } as never, overrideAccess: true, req, context: { reviewQuiet: true } })
}

async function reopenScheduled(req: PayloadRequest, t: ReviewTarget, a: ResolvedApprovals) {
  const scheduled = await req.payload.find({ collection: REVIEWS_SLUG as CollectionSlug, where: { and: [sameTarget(t), { status: { equals: 'scheduled' } }] }, depth: 0, limit: 10, overrideAccess: true, req })
  for (const doc of scheduled.docs) {
    const reopened = await req.payload.update({
      collection: REVIEWS_SLUG as CollectionSlug,
      id: doc.id,
      data: { status: 'waiting', publishAt: null, message: 'Changed after it was approved, so it needs another look.' } as never,
      overrideAccess: true,
      req,
      context: { reviewSystem: true, reviewQuiet: true },
    })
    await notifySubmitted(req, reopened as unknown as ReviewDoc, a)
  }
}

async function recordPublish(req: PayloadRequest, t: ReviewTarget) {
  if (!req.user) return
  const open = await req.payload.find({ collection: REVIEWS_SLUG as CollectionSlug, where: { and: [sameTarget(t), { status: { in: OPEN } }] }, depth: 0, limit: 50, overrideAccess: true, req })
  const now = new Date().toISOString()
  if (open.docs.length) {
    for (const doc of open.docs)
      await req.payload.update({ collection: REVIEWS_SLUG as CollectionSlug, id: doc.id, data: { status: 'published', reviewedBy: req.user.id, reviewedAt: now } as never, overrideAccess: true, req, context: { reviewPublished: true } })
    return
  }
  const described = await describe(req, t)
  await req.payload.create({
    collection: REVIEWS_SLUG as CollectionSlug,
    data: { ...t, docId: t.docId ? String(t.docId) : null, title: described?.title ?? t.entity, status: 'published', submittedBy: req.user.id, reviewedBy: req.user.id, reviewedAt: now } as never,
    overrideAccess: true,
    req,
    context: { reviewSystem: true, reviewQuiet: true },
  })
}

function reviewsCollection(a: ResolvedApprovals, usersSlug: string): CollectionConfig {
  const approver = (req: PayloadRequest) => canApprove(req.user, a)
  return {
    slug: REVIEWS_SLUG,
    labels: { singular: 'Review', plural: 'Reviews' },
    admin: { useAsTitle: 'title', hidden: true, defaultColumns: ['title', 'status', 'submittedBy', 'createdAt'] },
    access: {
      read: ({ req }) => Boolean(req.user),
      create: ({ req }) => Boolean(req.user),
      // Only approvers change a request: send it back, schedule or publish it.
      update: ({ req }) => approver(req),
      delete: () => false,
    },
    defaultSort: '-createdAt',
    endpoints: [
      {
        // Scheduled changes whose time has come. Called by a cron with CRON_SECRET, or by an approver.
        path: '/publish-due',
        method: 'get',
        handler: async (req) => {
          const secret = process.env.CRON_SECRET
          const byCron = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`
          if (!byCron && !approver(req)) return Response.json({ error: 'unauthorised' }, { status: 401 })
          const due = await req.payload.find({
            collection: REVIEWS_SLUG as CollectionSlug,
            where: { and: [{ status: { equals: 'scheduled' } }, { publishAt: { less_than_equal: new Date().toISOString() } }] },
            sort: 'publishAt',
            depth: 0,
            limit: 50,
            overrideAccess: true,
          })
          let published = 0
          const failed: { id: number | string; title: string }[] = []
          for (const review of due.docs as unknown as ReviewDoc[]) {
            try {
              await req.payload.update({ collection: REVIEWS_SLUG as CollectionSlug, id: review.id, data: { status: 'published', reviewedAt: new Date().toISOString() } as never, overrideAccess: true, context: { reviewSystem: true } })
              published++
            } catch (err) {
              req.payload.logger.error(`[reviews] scheduled publish of review ${review.id} failed: ${(err as Error).message}`)
              failed.push({ id: review.id, title: String(review.title ?? '') })
            }
          }
          return Response.json({ published, failed }, { headers: { 'Cache-Control': 'no-store' } })
        },
      },
    ],
    hooks: {
      beforeChange: [
        async ({ data, originalDoc, operation, req }) => {
          if (!data) return data
          // System calls (the scheduler, the publish hook) set every field themselves.
          if (!req.user || req.context.reviewSystem) return data
          if (operation === 'create') {
            const t: ReviewTarget = { kind: data.kind === 'global' ? 'global' : 'collection', entity: String(data.entity ?? ''), docId: data.docId ? String(data.docId) : null, locale: data.locale ?? null }
            const described = await describe(req, t)
            if (!described) throw new APIError("That page could not be found, so it can't be submitted.", 400)
            data.title = described.title
            data.docId = t.docId
            data.submittedBy = req.user.id
            // An approver may schedule their own change in one step; everyone else submits.
            const schedules = approver(req) && data.status === 'scheduled'
            if (schedules) future(data.publishAt)
            data.status = schedules ? 'scheduled' : 'waiting'
            if (!schedules) data.publishAt = null
            data.note = null
            if (schedules) {
              data.reviewedBy = req.user.id
              data.reviewedAt = new Date().toISOString()
            }
            return data
          }
          const next = (data.status ?? originalDoc?.status) as ReviewStatus
          if (next !== originalDoc?.status) {
            if (next === 'sentBack' && !String(data.note ?? '').trim()) throw new APIError('Add a note so the author knows what to change.', 400)
            if (next === 'scheduled') future(data.publishAt)
            if (next === 'waiting' || next === 'replaced') throw new APIError("That change can't be made here.", 400)
            data.reviewedBy = req.user.id
            data.reviewedAt = new Date().toISOString()
          }
          return data
        },
      ],
      afterChange: [
        async ({ doc, previousDoc, operation, req, context }) => {
          if (context.reviewQuiet) return doc
          const review = doc as ReviewDoc
          if (operation === 'create') {
            await replaceOpen(req, review, review.id)
            if (review.status === 'waiting') await notifySubmitted(req, review, a)
            else if (review.status === 'scheduled') await notifyAuthor(req, review, 'scheduled')
            return doc
          }
          const before = (previousDoc as ReviewDoc | undefined)?.status
          if (review.status === before) return doc
          // Published from the Reviews page or by the scheduler: publish the document itself.
          if (review.status === 'published' && !context.reviewPublished) await publishTarget(req, review)
          if (review.status === 'sentBack' || review.status === 'scheduled' || review.status === 'published') await notifyAuthor(req, review, review.status)
          return doc
        },
      ],
    },
    fields: [
      { name: 'title', type: 'text', required: true },
      {
        type: 'row',
        fields: [
          { name: 'kind', type: 'select', required: true, defaultValue: 'collection', options: [{ label: 'Collection', value: 'collection' }, { label: 'Global', value: 'global' }] },
          { name: 'entity', type: 'text', required: true, index: true },
          { name: 'docId', type: 'text', index: true },
          { name: 'locale', type: 'text', index: true },
        ],
      },
      { name: 'status', type: 'select', required: true, defaultValue: 'waiting', index: true, options: [...REVIEW_STATUSES] },
      { name: 'message', type: 'textarea' },
      { name: 'note', type: 'textarea' },
      { name: 'publishAt', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'submittedBy', type: 'relationship', relationTo: usersSlug as CollectionSlug },
      { name: 'reviewedBy', type: 'relationship', relationTo: usersSlug as CollectionSlug },
      { name: 'reviewedAt', type: 'date' },
    ],
  }
}

/* Wrapping collections and globals */

type PublishArgs = { data?: { _status?: unknown }; req: { user?: unknown; locale?: string | null; context?: Record<string, unknown> }; publishSpecificLocale?: string; publishAllLocales?: boolean }

/** Keeps a person's publish (or a review's) to the language they are in. */
function oneLanguage<A extends PublishArgs>(args: A): A {
  const { req } = args
  const fromPerson = Boolean(req.user) || Boolean(req.context?.approvalPublish)
  if (args.data?._status === 'published' && fromPerson && !args.publishSpecificLocale && !args.publishAllLocales && req.locale && req.locale !== 'all') {
    args.publishSpecificLocale = req.locale
  }
  return args
}

export function withApprovals(config: Config, a: ResolvedApprovals): Config {
  const usersSlug = config.admin?.user ?? 'users'
  const clientProps = { approverRoles: a.approverRoles, roleField: a.roleField }
  const button = { path: REVIEW_BUTTON, clientProps }
  const banner: UIField = { name: 'reviewBanner', type: 'ui', admin: { components: { Field: { path: REVIEW_BANNER, clientProps } } } }
  const included = (slug: string, entity: { versions?: unknown }) => hasDrafts(entity) && (!a.only || a.only.includes(slug))
  const refuse = () => {
    throw new APIError('Only an approver can publish. Use Submit for review, and an approver will publish it.', 403)
  }

  const collection = (c: CollectionConfig): CollectionConfig => {
    const guard: CollectionBeforeChangeHook = ({ data, req, context }) => {
      if (data?._status === 'published' && req.user && !canApprove(req.user, a) && !context.approvalPublish) refuse()
      return data
    }
    const language: CollectionBeforeOperationHook = ({ args, operation }) => (operation === 'update' || operation === 'updateByID' ? oneLanguage(args as PublishArgs) : args) as typeof args
    const record: CollectionAfterChangeHook = async ({ doc, req, context, operation }) => {
      if (!req.user || context.approvalPublish) return doc
      if (operation === 'create' && doc._status !== 'published') return doc
      const t: ReviewTarget = { kind: 'collection', entity: c.slug, docId: String(doc.id), locale: localeOf(req) }
      try {
        if (doc._status === 'published') await recordPublish(req, t)
        else if (!canApprove(req.user, a)) await reopenScheduled(req, t, a)
      } catch (err) {
        req.payload.logger.warn(`[reviews] ${c.slug} ${doc.id}: ${(err as Error).message}`)
      }
      return doc
    }
    return {
      ...c,
      fields: [banner, ...c.fields],
      admin: { ...c.admin, components: { ...c.admin?.components, edit: { ...c.admin?.components?.edit, PublishButton: button } } },
      hooks: {
        ...c.hooks,
        beforeOperation: [...(c.hooks?.beforeOperation ?? []), language],
        beforeChange: [guard, ...(c.hooks?.beforeChange ?? [])],
        afterChange: [...(c.hooks?.afterChange ?? []), record],
      },
    }
  }

  const global = (g: GlobalConfig): GlobalConfig => {
    const guard: GlobalBeforeChangeHook = ({ data, req, context }) => {
      if (data?._status === 'published' && req.user && !canApprove(req.user, a) && !context.approvalPublish) refuse()
      return data
    }
    const language: GlobalBeforeOperationHook = ({ args, operation }) => (operation === 'update' ? oneLanguage(args as unknown as PublishArgs) : args) as typeof args
    const record: GlobalAfterChangeHook = async ({ doc, req, context }) => {
      if (!req.user || context.approvalPublish) return doc
      const t: ReviewTarget = { kind: 'global', entity: g.slug, locale: localeOf(req) }
      try {
        if (doc._status === 'published') await recordPublish(req, t)
        else if (!canApprove(req.user, a)) await reopenScheduled(req, t, a)
      } catch (err) {
        req.payload.logger.warn(`[reviews] ${g.slug}: ${(err as Error).message}`)
      }
      return doc
    }
    return {
      ...g,
      fields: [banner, ...g.fields],
      admin: { ...g.admin, components: { ...g.admin?.components, elements: { ...g.admin?.components?.elements, PublishButton: button } } },
      hooks: {
        ...g.hooks,
        beforeOperation: [...(g.hooks?.beforeOperation ?? []), language],
        beforeChange: [guard, ...(g.hooks?.beforeChange ?? [])],
        afterChange: [...(g.hooks?.afterChange ?? []), record],
      },
    }
  }

  return {
    ...config,
    collections: [...(config.collections ?? []).map((c) => (included(c.slug, c) ? collection(c) : c)), reviewsCollection(a, usersSlug)],
    globals: (config.globals ?? []).map((g) => (included(g.slug, g) ? global(g) : g)),
  }
}
