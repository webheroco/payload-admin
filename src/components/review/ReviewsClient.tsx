// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The Reviews page's client side: tabs by stage with counts, a search box,
 * the Filters panel from the right, and a List / Board switch. Built like
 * the SEO overview so every list in the admin works the same way.
 */
import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import { Choice, FilterPanel } from '../seo/filters.js'
import { ReviewsBoard, type BoardColumn } from './ReviewsBoard.js'
import { formatWhen } from './shared.js'

export type ReviewItem = {
  id: string
  key: string
  status: 'waiting' | 'sentBack' | 'scheduled' | 'published' | 'replaced'
  title: string
  type: string
  entity: string
  language: string
  from: string
  reviewer: string
  note: string
  createdAt: string
  reviewedAt: string | null
  publishAt: string | null
  href: string
}

type Draft = { key: string; title: string; type: string; entity: string; updatedAt: string; href: string }

const TABS = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'sentBack', label: 'Changes requested' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['value']

const STATUS: Record<ReviewItem['status'], { label: string; dot: string }> = {
  waiting: { label: 'Waiting', dot: 'waiting' },
  sentBack: { label: 'Changes requested', dot: 'empty' },
  scheduled: { label: 'Scheduled', dot: 'none' },
  published: { label: 'Published', dot: 'good' },
  replaced: { label: 'Replaced', dot: 'none' },
}

const DEFAULTS = { type: 'all', language: 'all', from: 'all' }

export const ReviewsClient: React.FC<{
  apiRoute: string
  approver: boolean
  drafts: Draft[]
  initialView: 'list' | 'board'
  items: ReviewItem[]
  showLanguage: boolean
  types: { value: string; label: string }[]
}> = ({ apiRoute, approver, drafts, initialView, items, showLanguage, types }) => {
  const { setStepNav } = useStepNav()
  useEffect(() => setStepNav([{ label: 'Approvals' }]), [setStepNav])
  const [view, setView] = useState(initialView)
  const [tab, setTab] = useState<Tab>('waiting')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(DEFAULTS)
  const [panel, setPanel] = useState(false)
  const set = (key: keyof typeof DEFAULTS) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))

  const switchView = (next: 'list' | 'board') => {
    setView(next)
    const params = new URLSearchParams(window.location.search)
    if (next === 'board') params.set('view', 'board')
    else params.delete('view')
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
  }

  // The newest request per document and language: an older "sent back" is history once resubmitted.
  const latest = useMemo(() => {
    const seen = new Map<string, ReviewItem>()
    for (const r of items) if (!seen.has(r.key)) seen.set(r.key, r)
    return seen
  }, [items])
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const recentPublished = (r: ReviewItem) => r.status === 'published' && (r.reviewedAt ?? r.createdAt) >= weekAgo
  const inTab = (r: ReviewItem, t: Tab) =>
    t === 'all' ? true : t === 'published' ? recentPublished(r) : t === 'sentBack' ? r.status === t && latest.get(r.key) === r : r.status === t

  const q = query.trim().toLowerCase()
  const filtered = items.filter((r) => {
    if (filters.type !== 'all' && r.entity !== filters.type) return false
    if (filters.language !== 'all' && r.language !== filters.language) return false
    if (filters.from !== 'all' && r.from !== filters.from) return false
    return !q || [r.title, r.type, r.from, r.note].some((t) => t.toLowerCase().includes(q))
  })
  const rows = filtered.filter((r) => inTab(r, tab))
  const activeFilters = Object.values(filters).filter((v) => v !== 'all').length
  const languages = [...new Set(items.map((r) => r.language).filter(Boolean))]
  const people = [...new Set(items.map((r) => r.from).filter(Boolean))].sort()

  const card = (r: ReviewItem) => ({
    id: r.id,
    title: r.title,
    meta: [r.type, r.language, r.from].filter(Boolean).join(' · '),
    detail:
      r.status === 'sentBack'
        ? `“${r.note}”`
        : r.status === 'scheduled'
          ? `Goes live ${formatWhen(r.publishAt)}`
          : r.status === 'published'
            ? `${r.reviewer}, ${formatWhen(r.reviewedAt ?? r.createdAt)}`
            : `Submitted ${formatWhen(r.createdAt)}`,
    href: r.href,
    movable: approver && r.status === 'waiting',
  })
  const columns: BoardColumn[] = [
    {
      key: 'draft',
      label: 'Being written',
      cards: drafts
        .filter((d) => (filters.type === 'all' || d.entity === filters.type) && (!q || d.title.toLowerCase().includes(q)))
        .filter((d) => {
          const r = latest.get(d.key)
          return !r || r.status === 'published'
        })
        .slice(0, 8)
        .map((d) => ({ id: d.key, title: d.title, meta: d.type, detail: `Edited ${formatWhen(d.updatedAt)}`, href: d.href, movable: false })),
    },
    { key: 'waiting', label: 'Waiting for approval', cards: filtered.filter((r) => r.status === 'waiting').map(card), highlight: true },
    { key: 'sentBack', label: 'Changes requested', cards: filtered.filter((r) => r.status === 'sentBack' && latest.get(r.key) === r).slice(0, 20).map(card), dropTarget: approver },
    { key: 'scheduled', label: 'Scheduled', cards: filtered.filter((r) => r.status === 'scheduled').map(card), dropTarget: approver },
    { key: 'published', label: 'Published, 7 days', cards: filtered.filter(recentPublished).slice(0, 12).map(card) },
  ]

  return (
    <div className="cms-seo cms-reviews">
      <div className="cms-seo__bar">
        <div className="cms-tabs" role="tablist">
          {view === 'list' ? (
            TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                className={`cms-tabs__tab${tab === t.value ? ' is-active' : ''}`}
                onClick={() => setTab(t.value)}
              >
                {t.label} <span className="cms-tabs__count">{filtered.filter((r) => inTab(r, t.value)).length}</span>
              </button>
            ))
          ) : (
            <span className="cms-tabs__tab is-active">Board</span>
          )}
          <span className="cms-info" tabIndex={0} aria-label="About this page">
            i
            <span className="cms-info__note" role="tooltip">
              {approver
                ? 'Changes waiting for sign-off, and what has been approved (Published shows the last 7 days, All the last 90). Open one to approve and publish it, approve it for a date, or request changes. On the board, drag a waiting card to Changes requested or Scheduled.'
                : 'Your changes and where they are. Approvers publish them, or ask for changes with a note.'}
            </span>
          </span>
        </div>
        <div className="cms-seo__tools">
          <input
            className="cms-input cms-seo__search"
            type="search"
            placeholder="Search approvals"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={`cms-button cms-button--outline${activeFilters ? ' is-active' : ''}`}
            onClick={() => setPanel(true)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filters{activeFilters ? <span className="cms-button__badge">{activeFilters}</span> : null}
          </button>
          <span className="cms-reviews__switch" role="group" aria-label="View">
            <a href="?" className={view === 'list' ? 'is-on' : ''} onClick={(e) => (e.preventDefault(), switchView('list'))} aria-current={view === 'list' ? 'page' : undefined}>
              List
            </a>
            <a href="?view=board" className={view === 'board' ? 'is-on' : ''} onClick={(e) => (e.preventDefault(), switchView('board'))} aria-current={view === 'board' ? 'page' : undefined}>
              Board
            </a>
          </span>
        </div>
      </div>

      {view === 'list' ? (
        <>
          <table className="cms-table cms-seo__table cms-reviews__table">
            <thead>
              <tr>
                <th>Change</th>
                <th>Type</th>
                {showLanguage ? <th>Language</th> : null}
                <th>From</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cms-seo__cell-page">
                    <Link href={r.href} prefetch={false} className="cms-seo__page">
                      {r.title}
                    </Link>
                    {r.status === 'sentBack' && r.note ? <span className="cms-reviews__meta">“{r.note}”</span> : null}
                  </td>
                  <td className="cms-seo__cell-kind">{r.type}</td>
                  {showLanguage ? <td className="cms-seo__cell-kind">{r.language || 'All'}</td> : null}
                  <td className="cms-seo__cell-kind">{r.from}</td>
                  <td>
                    <span className="cms-reviews__status">
                      <span className={`cms-seo__dot is-${STATUS[r.status].dot}`} aria-hidden="true" />
                      {STATUS[r.status].label}
                    </span>
                  </td>
                  <td className="cms-seo__cell-kind">
                    {r.status === 'scheduled' ? `Live ${formatWhen(r.publishAt)}` : r.status === 'waiting' ? formatWhen(r.createdAt) : formatWhen(r.reviewedAt ?? r.createdAt)}
                    {r.status !== 'waiting' && r.reviewer ? <span className="cms-reviews__meta">by {r.reviewer}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="cms-seo__empty">{tab === 'waiting' && !activeFilters && !q ? 'Nothing is waiting for review.' : 'Nothing here.'}</p>}
        </>
      ) : (
        <ReviewsBoard columns={columns} apiRoute={apiRoute} canMove={approver} />
      )}

      <FilterPanel open={panel} onClose={() => setPanel(false)} onClear={() => setFilters(DEFAULTS)}>
        <Choice
          legend="Type"
          value={filters.type}
          onChange={set('type')}
          options={[{ value: 'all', label: 'All types' }, ...types.map((t) => ({ ...t, count: items.filter((r) => r.entity === t.value).length }))]}
        />
        {showLanguage && languages.length > 1 ? (
          <Choice
            legend="Language"
            value={filters.language}
            onChange={set('language')}
            options={[{ value: 'all', label: 'All languages' }, ...languages.map((l) => ({ value: l, label: l, count: items.filter((r) => r.language === l).length }))]}
          />
        ) : null}
        {approver && people.length > 1 ? (
          <Choice
            legend="From"
            value={filters.from}
            onChange={set('from')}
            options={[{ value: 'all', label: 'Anyone' }, ...people.map((p) => ({ value: p, label: p, count: items.filter((r) => r.from === p).length }))]}
          />
        ) : null}
      </FilterPanel>
    </div>
  )
}
