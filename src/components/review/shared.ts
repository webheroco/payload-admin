// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { useAuth, useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

/** A review row as the REST API returns it at depth 1 (approvals.ts). */
export type Review = {
  id: number | string
  status: 'waiting' | 'sentBack' | 'scheduled' | 'published' | 'replaced'
  title?: string | null
  note?: string | null
  message?: string | null
  publishAt?: string | null
  createdAt: string
  reviewedAt?: string | null
  submittedBy?: { id: number | string; name?: string | null; email?: string | null } | number | string | null
  reviewedBy?: { id: number | string; name?: string | null; email?: string | null } | number | string | null
}

const CHANGED = 'webhero:review-changed'

export const announceReviewChange = () => window.dispatchEvent(new Event(CHANGED))

export const personName = (p: Review['submittedBy'], fallback = 'Someone') =>
  p && typeof p === 'object' ? p.name || p.email || fallback : fallback

export const formatWhen = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

/** Who may publish: set by webheroAdmin({ approvals }) and passed to each component as props. */
export type ApproverProps = { approverRoles?: string[]; roleField?: string }

export const isApprover = (user: unknown, { approverRoles = ['super-admin', 'client-admin'], roleField = 'role' }: ApproverProps) => {
  const value = (user as Record<string, unknown> | null)?.[roleField]
  return (Array.isArray(value) ? value : [value]).some((v) => typeof v === 'string' && approverRoles.includes(v))
}

/**
 * The document this editor screen shows, as a review target, plus the
 * newest review about it in the market being edited. Refetches after a save
 * and whenever a review button changes something.
 */
export function useReviewTarget(who: ApproverProps = {}) {
  const { id, collectionSlug, globalSlug, lastUpdateTime } = useDocumentInfo()
  const { code: locale } = useLocale()
  const { user } = useAuth()
  const { config } = useConfig()
  const api = `${config.serverURL ?? ''}${config.routes.api}`
  const target = globalSlug
    ? { kind: 'global' as const, entity: globalSlug, docId: null, locale }
    : { kind: 'collection' as const, entity: collectionSlug ?? '', docId: id ? String(id) : null, locale }
  const ready = Boolean(target.entity) && (target.kind === 'global' || Boolean(target.docId))
  const [latest, setLatest] = useState<Review | null>(null)

  const load = useCallback(async () => {
    if (!ready) return setLatest(null)
    const params = new URLSearchParams({ limit: '1', depth: '1', sort: '-createdAt' })
    params.set('where[and][0][kind][equals]', target.kind)
    params.set('where[and][1][entity][equals]', target.entity)
    params.set('where[and][2][status][not_equals]', 'replaced')
    if (target.docId) params.set('where[and][3][docId][equals]', target.docId)
    if (locale) params.set('where[and][4][locale][equals]', locale)
    try {
      const res = await fetch(`${api}/reviews?${params}`, { credentials: 'include' })
      const body = res.ok ? await res.json() : null
      setLatest((body?.docs?.[0] as Review | undefined) ?? null)
    } catch {
      setLatest(null)
    }
  }, [api, ready, target.kind, target.entity, target.docId, locale])

  useEffect(() => {
    void load()
  }, [load, lastUpdateTime])

  useEffect(() => {
    const on = () => void load()
    window.addEventListener(CHANGED, on)
    return () => window.removeEventListener(CHANGED, on)
  }, [load])

  const open = latest && (latest.status === 'waiting' || latest.status === 'scheduled') ? latest : null

  return { api, target, ready, latest, open, user, approver: isApprover(user, who) }
}

/** POST or PATCH a review; resolves with the error message, or null when it worked. */
export async function sendReview(api: string, method: 'POST' | 'PATCH', path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${api}/reviews${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return null
    const json = await res.json().catch(() => null)
    return (json?.errors?.[0]?.message as string | undefined) ?? 'That did not work. Please try again.'
  } catch {
    return 'That did not work. Please check your connection and try again.'
  }
}
