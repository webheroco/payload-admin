// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The SEO overview's Schema tab. The site's code writes the structured data,
 * so this reads each indexed page as the public sees it and checks the
 * JSON-LD it finds (schema-rules.ts). Site-wide types (Organization,
 * WebSite, BreadcrumbList) are one summary at the top; the table lists the
 * page types, and only the types this site uses appear anywhere.
 */
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { checkHtml, SITE_WIDE, worst, type Check, type Verdict } from '../../schema-rules.js'
import { Choice, FilterPanel } from './filters.js'
import type { SeoRow } from './SeoTable.js'

type Result = { state: 'checking' } | { state: 'done'; checks: Check[] } | { state: 'failed'; reason: string }

const TIP: Record<Verdict, string> = {
  good: 'Valid',
  warn: 'Valid, with recommended properties missing',
  error: 'Errors: not eligible for rich results',
  none: 'Found, no checks for this type',
}

const Dot: React.FC<{ verdict: Verdict; label?: string }> = ({ verdict, label }) => (
  <span className={`cms-seo__dot is-${verdict}`} data-tip={label ?? TIP[verdict]} role="img" aria-label={label ?? TIP[verdict]} />
)

/** Read one page and check its JSON-LD. Same origin as the admin, so it reads what visitors get. */
async function readPage(path: string, signal: AbortSignal): Promise<Result> {
  try {
    const res = await fetch(path, { cache: 'no-store', credentials: 'include', signal })
    if (!res.ok) return { state: 'failed', reason: res.status === 404 ? 'Not live' : `Page answered ${res.status}` }
    return { state: 'done', checks: checkHtml(await res.text()) }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return { state: 'failed', reason: 'Could not read the page' }
  }
}

export const SCHEMA_DEFAULTS = { type: 'all', result: 'all' }

export const SchemaTab: React.FC<{
  rows: SeoRow[]
  query: string
  panel: boolean
  onPanel: (open: boolean) => void
  onFilterCount: (n: number) => void
  recheck: number
}> = ({ rows, query, panel, onPanel, onFilterCount, recheck }) => {
  // Only pages search engines may list: schema on a hidden page does nothing.
  const pages = useMemo(() => rows.filter((r) => r.indexed && r.path), [rows])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [filters, setFilters] = useState(SCHEMA_DEFAULTS)
  const set = (key: keyof typeof SCHEMA_DEFAULTS) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))
  const key = (r: SeoRow) => `${r.collection}-${r.id}`

  const run = useCallback(
    (signal: AbortSignal) => {
      setResults(Object.fromEntries(pages.map((r) => [key(r), { state: 'checking' } as Result])))
      // Four at a time, so a big site doesn't hit its own server with every page at once.
      let next = 0
      const worker = async () => {
        while (next < pages.length && !signal.aborted) {
          const row = pages[next++]
          const result = await readPage(row.path, signal).catch(() => null)
          if (result) setResults((all) => ({ ...all, [key(row)]: result }))
        }
      }
      void Promise.all([worker(), worker(), worker(), worker()])
    },
    [pages],
  )

  useEffect(() => {
    const controller = new AbortController()
    run(controller.signal)
    return () => controller.abort()
  }, [run, recheck])

  const done = pages.filter((r) => results[key(r)]?.state !== 'checking').length
  const checksOf = (r: SeoRow) => {
    const res = results[key(r)]
    return res?.state === 'done' ? res.checks : []
  }

  // Site-wide types: one card each, with how many pages carry them and their worst result.
  const siteWide = useMemo(() => {
    const byType = new Map<string, { pages: number; verdicts: Verdict[]; issues: Map<string, number> }>()
    for (const r of pages)
      for (const c of new Map(checksOf(r).filter((c) => SITE_WIDE.has(c.type)).map((c) => [c.type, c])).values()) {
        const entry = byType.get(c.type) ?? { pages: 0, verdicts: [], issues: new Map<string, number>() }
        entry.pages += 1
        entry.verdicts.push(c.verdict)
        if (c.verdict === 'error' || c.verdict === 'warn') c.issues.forEach((i) => entry.issues.set(i, (entry.issues.get(i) ?? 0) + 1))
        byType.set(c.type, entry)
      }
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, results])

  const pageChecks = (r: SeoRow) => checksOf(r).filter((c) => !SITE_WIDE.has(c.type))
  const pageTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of pages) for (const t of new Set(pageChecks(r).map((c) => c.type))) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, results])
  const verdictOf = (r: SeoRow): Verdict | 'missing' => {
    const checks = pageChecks(r)
    return checks.length ? worst(checks.map((c) => c.verdict)) : 'missing'
  }

  const activeFilters = Object.values(filters).filter((v) => v !== 'all').length
  useEffect(() => onFilterCount(activeFilters), [activeFilters, onFilterCount])

  const q = query.trim().toLowerCase()
  const visible = pages.filter((r) => {
    const checks = pageChecks(r)
    if (filters.type === 'none' && checks.length) return false
    if (filters.type !== 'all' && filters.type !== 'none' && !checks.some((c) => c.type === filters.type)) return false
    if (filters.result !== 'all' && verdictOf(r) !== filters.result) return false
    return !q || [r.title, r.path, ...checks.map((c) => c.type)].some((t) => t.toLowerCase().includes(q))
  })
  const count = (v: Verdict | 'missing') => pages.filter((r) => verdictOf(r) === v).length

  return (
    <>
      {done < pages.length && (
        <div className="cms-schema__progress" role="status">
          <span>
            Reading pages: {done} of {pages.length}
          </span>
          <span className="cms-schema__bar">
            <span style={{ width: `${pages.length ? (done / pages.length) * 100 : 0}%` }} />
          </span>
        </div>
      )}

      {siteWide.length > 0 && (
        <section className="cms-schema__site" aria-label="Site-wide schema">
          {siteWide.map(([type, entry]) => {
            const v = worst(entry.verdicts)
            return (
              <div key={type} className="cms-schema__card">
                <span className="cms-schema__card-head">
                  <Dot verdict={v} />
                  <span className="cms-schema__type">{type}</span>
                </span>
                <span className="cms-schema__card-meta">
                  Site-wide, on {entry.pages} of {pages.length} pages
                </span>
                {entry.issues.size ? (
                  <ul className="cms-schema__issues">
                    {[...entry.issues].map(([issue, n]) => (
                      <li key={issue}>
                        {issue}
                        {n < entry.pages ? `, on ${n} ${n === 1 ? 'page' : 'pages'}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </section>
      )}

      <table className="cms-table cms-seo__table cms-schema__table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Slug</th>
            <th>Schema</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const res = results[key(row)]
            const checks = pageChecks(row)
            const issues = checks.flatMap((c) => (c.verdict === 'error' || c.verdict === 'warn' ? c.issues.map((i) => `${c.type}: ${i}`) : []))
            return (
              <tr key={key(row)}>
                <td className="cms-seo__cell-page">
                  <Link href={row.editHref} prefetch={false} className="cms-seo__page">
                    {row.title}
                  </Link>
                </td>
                <td className="cms-seo__cell-path">
                  <a className="cms-seo__path" href={row.path} target="_blank" rel="noopener noreferrer" title={row.path}>
                    {row.path}
                  </a>
                </td>
                <td>
                  {!res || res.state === 'checking' ? (
                    <span className="cms-schema__muted">Reading…</span>
                  ) : res.state === 'failed' ? (
                    <span className="cms-schema__muted">{res.reason}</span>
                  ) : checks.length ? (
                    <span className="cms-schema__types">
                      {checks.map((c, i) => (
                        <span key={`${c.type}-${i}`} className="cms-schema__chip">
                          <Dot verdict={c.verdict} />
                          {c.type}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="cms-schema__muted">None</span>
                  )}
                </td>
                <td>
                  {issues.length ? (
                    <ul className="cms-schema__issues">
                      {issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {visible.length === 0 && done === pages.length && (
        <p className="cms-seo__empty">Nothing matches. Try clearing the search or filters.</p>
      )}

      <FilterPanel open={panel} onClose={() => onPanel(false)} onClear={() => setFilters(SCHEMA_DEFAULTS)}>
        <Choice
          legend="Schema type"
          value={filters.type}
          onChange={set('type')}
          options={[
            { value: 'all', label: 'Any' },
            ...pageTypes.map(([t, n]) => ({ value: t, label: t, count: n })),
            { value: 'none', label: 'No page schema', count: count('missing') },
          ]}
        />
        <Choice
          legend="Result"
          value={filters.result}
          onChange={set('result')}
          options={[
            { value: 'all', label: 'Any result' },
            { value: 'error', label: 'Errors', count: count('error') },
            { value: 'warn', label: 'Recommended missing', count: count('warn') },
            { value: 'good', label: 'Valid', count: count('good') },
          ]}
        />
      </FilterPanel>
    </>
  )
}
