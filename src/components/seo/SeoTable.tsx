// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The SEO overview's client side: tabs for search listings and redirects,
 * a search box, a Filters panel that slides in from the right, and cells you
 * click to edit in place. No Edit buttons: the page name opens the page.
 */
import { toast, useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

export type SeoRow = {
  id: string
  collection: string
  kind: string
  title: string
  titleTranslated: boolean
  path: string
  searchTitle: string
  description: string
  indexed: boolean
  hasDraft: boolean
  editHref: string
}

export type RedirectRow = {
  id: string
  from: string
  toType: 'reference' | 'custom'
  toRef: string
  toUrl: string
  type: '301' | '302'
}

type Range = { min: number; max: number }
const TITLE: Range = { min: 30, max: 60 }
const DESCRIPTION: Range = { min: 70, max: 160 }

const verdict = (text: string, range: Range) => {
  const n = text.trim().length
  if (n === 0) return { label: 'Missing', tone: 'warn' as const, n }
  if (n < range.min) return { label: 'Short', tone: 'warn' as const, n }
  if (n > range.max) return { label: 'Long', tone: 'warn' as const, n }
  return { label: 'Good', tone: 'good' as const, n }
}

const needsAttention = (row: SeoRow) =>
  verdict(row.searchTitle, TITLE).tone === 'warn' || verdict(row.description, DESCRIPTION).tone === 'warn'

const Length: React.FC<{ text: string; range: Range }> = ({ text, range }) => {
  const v = verdict(text, range)
  return (
    <span className="cms-seo__length">
      <span className={`cms-pill cms-pill--${v.tone}`}>{v.label}</span>
      <span className="cms-seo__count">
        {v.n} / {range.max}
      </span>
    </span>
  )
}

const api = async (url: string, method: string, body?: unknown) => {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? 'Could not save')
  return json
}

/** Text that turns into a field when clicked. Enter or clicking away saves; Esc cancels. */
const EditableText: React.FC<{
  value: string
  placeholder: string
  multiline?: boolean
  range?: Range
  label: string
  onSave: (value: string) => Promise<void>
}> = ({ value, placeholder, multiline, range, label, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (editing) {
      field.current?.focus()
      field.current?.select()
    }
  }, [editing])

  const commit = async () => {
    const next = draft.trim()
    if (next === value.trim()) return setEditing(false)
    setSaving(true)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void commit()
    }
  }

  if (editing) {
    const props = {
      ref: field,
      className: 'cms-input cms-edit__field',
      value: draft,
      'aria-label': label,
      disabled: saving,
      onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown: keys,
    }
    return (
      <div className="cms-edit is-editing">
        {multiline ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
        <span className="cms-edit__foot">
          {range ? <Length text={draft} range={range} /> : <span />}
          <span className="cms-edit__hint">{saving ? 'Saving…' : 'Enter to save, Esc to cancel'}</span>
        </span>
      </div>
    )
  }

  return (
    <button type="button" className="cms-edit" onClick={() => setEditing(true)} aria-label={`Edit ${label}`}>
      <span className={`cms-edit__text${value ? '' : ' is-empty'}`}>{value || placeholder}</span>
      <svg
        className="cms-edit__pen"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" strokeLinejoin="round" />
      </svg>
      {range ? <Length text={value} range={range} /> : null}
    </button>
  )
}

/** A side panel from the right for filters that don't need to be on screen all the time. */
const FilterPanel: React.FC<{ open: boolean; onClose: () => void; onClear: () => void; children: React.ReactNode }> = ({
  open,
  onClose,
  onClear,
  children,
}) => {
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])
  return (
    <div className={`cms-panel${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="cms-panel__scrim" onClick={onClose} />
      <aside className="cms-panel__sheet" role="dialog" aria-label="Filters">
        <header className="cms-panel__head">
          <h2>Filters</h2>
          <button type="button" className="cms-panel__close" onClick={onClose} aria-label="Close filters">
            ×
          </button>
        </header>
        <div className="cms-panel__body">{children}</div>
        <footer className="cms-panel__foot">
          <button type="button" className="cms-button cms-button--quiet" onClick={onClear}>
            Clear filters
          </button>
          <button type="button" className="cms-button" onClick={onClose}>
            Done
          </button>
        </footer>
      </aside>
    </div>
  )
}

const Choice: React.FC<{
  legend: string
  value: string
  options: { value: string; label: string; count?: number }[]
  onChange: (value: string) => void
}> = ({ legend, value, options, onChange }) => (
  <fieldset className="cms-choice">
    <legend>{legend}</legend>
    {options.map((o) => (
      <label key={o.value} className={`cms-choice__option${value === o.value ? ' is-active' : ''}`}>
        <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} />
        <span>{o.label}</span>
        {o.count !== undefined ? <span className="cms-choice__count">{o.count}</span> : null}
      </label>
    ))}
  </fieldset>
)

export const SeoWorkspace: React.FC<{
  apiRoute: string
  initialTab: 'listings' | 'redirects'
  locale?: string
  localeLabel?: string
  rows: SeoRow[]
  /** null when the signed-in user can't manage redirects: no Redirects tab. */
  redirects: RedirectRow[] | null
}> = ({ apiRoute, initialTab, locale, localeLabel, rows: initialRows, redirects: initialRedirects }) => {
  const { setStepNav } = useStepNav()
  const canRedirect = initialRedirects !== null
  const [tab, setTab] = useState(canRedirect ? initialTab : 'listings')
  const [rows, setRows] = useState(initialRows)
  const [redirects, setRedirects] = useState(initialRedirects ?? [])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [show, setShow] = useState('all')
  const [panel, setPanel] = useState(false)

  // The title lives in the breadcrumb, not in a heading row.
  useEffect(() => setStepNav([{ label: 'SEO overview' }]), [setStepNav])
  useEffect(() => setRows(initialRows), [initialRows])
  useEffect(() => setRedirects(initialRedirects ?? []), [initialRedirects])

  const switchTab = (next: 'listings' | 'redirects') => {
    setTab(next)
    setQuery('')
    const params = new URLSearchParams(window.location.search)
    if (next === 'redirects') params.set('tab', 'redirects')
    else params.delete('tab')
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`)
  }

  const kinds = useMemo(() => Array.from(new Set(rows.map((r) => r.kind))), [rows])
  const attention = rows.filter(needsAttention).length
  const activeFilters = (kind !== 'all' ? 1 : 0) + (show !== 'all' ? 1 : 0)
  const q = query.trim().toLowerCase()

  const visible = rows.filter((row) => {
    if (kind !== 'all' && row.kind !== kind) return false
    if (show === 'attention' && !needsAttention(row)) return false
    if (show === 'hidden' && row.indexed) return false
    return !q || [row.title, row.path, row.searchTitle, row.description].some((t) => t.toLowerCase().includes(q))
  })

  const saveMeta = (row: SeoRow, field: 'title' | 'description') => async (value: string) => {
    const params = new URLSearchParams({ depth: '0' })
    if (locale) params.set('locale', locale)
    // Pages with unpublished edits get this saved into their draft, so we never publish those edits.
    if (row.hasDraft) params.set('draft', 'true')
    await api(`${apiRoute}/${row.collection}/${row.id}?${params}`, 'PATCH', {
      meta: { [field]: value },
      _status: row.hasDraft ? 'draft' : 'published',
    })
    setRows((all) =>
      all.map((r) =>
        r.id === row.id && r.collection === row.collection
          ? { ...r, [field === 'title' ? 'searchTitle' : 'description']: value }
          : r,
      ),
    )
    toast.success(row.hasDraft ? 'Saved to the draft. Publish the page to put it live.' : 'Saved and live.')
  }

  // Redirect targets: every page and post, by name.
  const targets = rows.map((r) => ({ value: `${r.collection}:${r.id}`, label: `${r.title} (${r.path})` }))

  /** Numeric IDs (Postgres, SQLite) go back as numbers; string IDs (MongoDB, custom) stay strings. */
  const refId = (id: string): number | string => (/^\d+$/.test(id) ? Number(id) : id)

  const saveRedirect = async (row: RedirectRow, patch: Partial<RedirectRow>) => {
    const next = { ...row, ...patch }
    const body = {
      from: next.from,
      type: next.type,
      to:
        next.toType === 'custom'
          ? { type: 'custom', url: next.toUrl }
          : {
              type: 'reference',
              reference: next.toRef
                ? { relationTo: next.toRef.split(':')[0], value: refId(next.toRef.split(':').slice(1).join(':')) }
                : undefined,
            },
    }
    const ready = next.from && (next.toType === 'custom' ? next.toUrl : next.toRef)
    if (row.id.startsWith('new-')) {
      setRedirects((all) => all.map((r) => (r.id === row.id ? next : r)))
      if (!ready) return
      const json = await api(`${apiRoute}/redirects?depth=0`, 'POST', body)
      setRedirects((all) => all.map((r) => (r.id === row.id ? { ...next, id: String(json.doc.id) } : r)))
      toast.success('Redirect added.')
      return
    }
    await api(`${apiRoute}/redirects/${row.id}?depth=0`, 'PATCH', body)
    setRedirects((all) => all.map((r) => (r.id === row.id ? next : r)))
    toast.success('Redirect saved.')
  }

  const removeRedirect = async (row: RedirectRow) => {
    if (!row.id.startsWith('new-')) await api(`${apiRoute}/redirects/${row.id}`, 'DELETE')
    setRedirects((all) => all.filter((r) => r.id !== row.id))
    if (!row.id.startsWith('new-')) toast.success('Redirect removed.')
  }

  const shownRedirects = redirects.filter(
    (r) => !q || r.from.toLowerCase().includes(q) || r.toUrl.toLowerCase().includes(q),
  )

  return (
    <div className="cms-seo">
      {/* Tabs, counts, search and filters: one row. */}
      <div className="cms-seo__bar">
        <div className="cms-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'listings'}
            className={`cms-tabs__tab${tab === 'listings' ? ' is-active' : ''}`}
            onClick={() => switchTab('listings')}
          >
            Search listings <span className="cms-tabs__count">{rows.length}</span>
          </button>
          {canRedirect && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'redirects'}
              className={`cms-tabs__tab${tab === 'redirects' ? ' is-active' : ''}`}
              onClick={() => switchTab('redirects')}
            >
              Redirects{' '}
              <span className="cms-tabs__count">{redirects.filter((r) => !r.id.startsWith('new-')).length}</span>
            </button>
          )}
          <span className="cms-info" tabIndex={0} aria-label="About this page">
            i
            <span className="cms-info__note" role="tooltip">
              {tab === 'listings'
                ? `What search engines show for each page and post${localeLabel ? ` in ${localeLabel}` : ''}. Click any title or description to change it. Aim for titles of ${TITLE.min} to ${TITLE.max} characters and descriptions of ${DESCRIPTION.min} to ${DESCRIPTION.max}.`
                : 'Send visitors from an old address to a page that exists. Permanent (301) tells search engines the page has moved for good.'}
            </span>
          </span>
        </div>

        <div className="cms-seo__tools">
          {tab === 'listings' && attention > 0 && (
            <button
              type="button"
              className={`cms-chip cms-chip--warn${show === 'attention' ? ' is-active' : ''}`}
              onClick={() => setShow(show === 'attention' ? 'all' : 'attention')}
              aria-pressed={show === 'attention'}
            >
              {attention} need attention
            </button>
          )}
          <input
            className="cms-input cms-seo__search"
            type="search"
            placeholder={tab === 'listings' ? 'Search pages' : 'Search redirects'}
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {tab === 'listings' ? (
            <button
              type="button"
              className={`cms-button cms-button--outline${activeFilters ? ' is-active' : ''}`}
              onClick={() => setPanel(true)}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filters{activeFilters ? <span className="cms-button__badge">{activeFilters}</span> : null}
            </button>
          ) : (
            <button
              type="button"
              className="cms-button"
              onClick={() =>
                setRedirects((all) => [
                  { id: `new-${Date.now()}`, from: '', toType: 'reference', toRef: '', toUrl: '', type: '301' },
                  ...all,
                ])
              }
            >
              Add redirect
            </button>
          )}
        </div>
      </div>

      {tab === 'listings' ? (
        <>
          {(activeFilters > 0 || q) && (
            <p className="cms-seo__showing">
              Showing {visible.length} of {rows.length}
            </p>
          )}
          <table className="cms-table cms-seo__table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Search title</th>
                <th>Description</th>
                <th>Index</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.collection}-${row.id}`}>
                  <td>
                    <Link href={row.editHref} prefetch={false} className="cms-seo__page">
                      {row.title}
                    </Link>
                    <span className="cms-seo__path">{row.path}</span>
                    <span className="cms-seo__kind">
                      {row.kind}
                      {row.titleTranslated ? '' : ' · not translated'}
                      {row.hasDraft ? ' · has unpublished changes' : ''}
                    </span>
                  </td>
                  <td>
                    <EditableText
                      value={row.searchTitle}
                      placeholder="Add a search title"
                      range={TITLE}
                      label={`search title for ${row.title}`}
                      onSave={saveMeta(row, 'title')}
                    />
                  </td>
                  <td>
                    <EditableText
                      value={row.description}
                      placeholder="Add a description"
                      multiline
                      range={DESCRIPTION}
                      label={`description for ${row.title}`}
                      onSave={saveMeta(row, 'description')}
                    />
                  </td>
                  <td>
                    <span className={`cms-pill ${row.indexed ? 'cms-pill--good' : ''}`}>
                      {row.indexed ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="cms-seo__empty">Nothing matches. Try clearing the search or filters.</p>
          )}

          <FilterPanel
            open={panel}
            onClose={() => setPanel(false)}
            onClear={() => {
              setKind('all')
              setShow('all')
            }}
          >
            <Choice
              legend="Type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'All types', count: rows.length },
                ...kinds.map((k) => ({ value: k, label: `${k}s`, count: rows.filter((r) => r.kind === k).length })),
              ]}
            />
            <Choice
              legend="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: 'all', label: 'Everything' },
                { value: 'attention', label: 'Needs attention', count: attention },
                { value: 'hidden', label: 'Hidden from search', count: rows.filter((r) => !r.indexed).length },
              ]}
            />
          </FilterPanel>
        </>
      ) : (
        <table className="cms-table cms-seo__table cms-seo__table--redirects">
          <thead>
            <tr>
              <th>Old address</th>
              <th>Goes to</th>
              <th>Kind</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {shownRedirects.map((row) => (
              <tr key={row.id}>
                <td>
                  <EditableText
                    value={row.from}
                    placeholder="/old-address"
                    label="old address"
                    onSave={(from) =>
                      saveRedirect(row, { from: from.startsWith('/') || /^https?:/.test(from) ? from : `/${from}` })
                    }
                  />
                </td>
                <td>
                  <div className="cms-seo__to">
                    <select
                      className="cms-select"
                      aria-label="Goes to"
                      value={row.toType === 'custom' ? 'custom' : row.toRef}
                      onChange={(e) =>
                        e.target.value === 'custom'
                          ? setRedirects((all) => all.map((r) => (r.id === row.id ? { ...r, toType: 'custom' } : r)))
                          : saveRedirect(row, { toType: 'reference', toRef: e.target.value }).catch((err) =>
                              toast.error(err.message),
                            )
                      }
                    >
                      <option value="" disabled>
                        Choose a page
                      </option>
                      {targets.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                      <option value="custom">Another address…</option>
                    </select>
                    {row.toType === 'custom' && (
                      <EditableText
                        value={row.toUrl}
                        placeholder="Type the address"
                        label="address to send visitors to"
                        onSave={(toUrl) => saveRedirect(row, { toType: 'custom', toUrl })}
                      />
                    )}
                  </div>
                </td>
                <td>
                  <select
                    className="cms-select"
                    aria-label="Kind of redirect"
                    value={row.type}
                    onChange={(e) =>
                      saveRedirect(row, { type: e.target.value as '301' | '302' }).catch((err) =>
                        toast.error(err.message),
                      )
                    }
                  >
                    <option value="301">Permanent</option>
                    <option value="302">Temporary</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="cms-icon-button"
                    data-tip="Remove"
                    aria-label={`Remove redirect from ${row.from || 'new row'}`}
                    onClick={() => removeRedirect(row).catch((err) => toast.error(err.message))}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'redirects' && shownRedirects.length === 0 && (
        <p className="cms-seo__empty">No redirects yet. Add one when a page moves or is removed.</p>
      )}
    </div>
  )
}
