// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The Performance page: enquiries from the website's forms, by type, by page
 * and over time. The "?" note and period share one row (the site menu already
 * names the site); the title is in
 * the breadcrumb.
 */
import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { BarList, number, StackedBars } from './charts.js'
import { Icon } from '../nav/icons.js'

export type Enquiry = { id: string; form: string; page: string; name: string; at: string; href: string }

const COLORS = ['#0d9488', '#d97706', '#7c3aed', '#e11d48', '#0284c7', '#65a30d', '#c026d3', '#57534e']

const change = (now: number, before: number) => (before ? (now - before) / before : 0)

const Delta: React.FC<{ value: number }> = ({ value }) => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return <span className="cms-delta">No change</span>
  const up = value > 0
  return (
    <span className={`cms-delta ${up ? 'is-good' : 'is-bad'}`}>
      {up ? '▲' : '▼'} {Math.abs(value * 100).toFixed(0)}%
    </span>
  )
}

const Kpi: React.FC<{ label: string; value: React.ReactNode; delta?: React.ReactNode; note?: string }> = ({ label, value, delta, note }) => (
  <div className="cms-kpi">
    <span className="cms-kpi__label">{label}</span>
    <span className="cms-kpi__value">{value}</span>
    <span className="cms-kpi__foot">
      {delta}
      {note ? <span className="cms-kpi__note">{note}</span> : null}
    </span>
  </div>
)

const Panel: React.FC<{ title: string; wide?: boolean; children?: React.ReactNode }> = ({ title, wide, children }) => (
  <section className={`cms-card${wide ? ' is-wide' : ''}`}>
    <header className="cms-card__head">
      <h3>{title}</h3>
    </header>
    {children}
  </section>
)

const dayKey = (iso: string) => iso.slice(0, 10)
const weekday = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' })
const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

export const PerformanceClient: React.FC<{
  days: number
  periods: number[]
  siteName?: string
  start: string
  end: string
  enquiries: Enquiry[]
}> = ({ days, periods, start, end, enquiries }) => {
  const { setStepNav } = useStepNav()
  const router = useRouter()
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => setStepNav([{ label: 'Performance' }]), [setStepNav])

  const go = (period: number) => {
    const params = new URLSearchParams(window.location.search)
    params.set('period', String(period))
    router.push(`${window.location.pathname}?${params}`)
  }

  // Enquiries in this period and the one before
  const current = useMemo(() => enquiries.filter((e) => e.at >= start), [enquiries, start])
  const before = enquiries.length - current.length

  const forms = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of current) counts.set(e.form, (counts.get(e.form) ?? 0) + 1)
    return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [current])
  const colorOf = (form: string) => COLORS[forms.findIndex((f) => f.label === form) % COLORS.length]

  // Per day for 7 and 30 days, per week for 90.
  const unit = days > 45 ? 'week' : 'day'
  const buckets = useMemo(() => {
    const dates: string[] = []
    const last = new Date(end).getTime()
    for (let i = days - 1; i >= 0; i--) dates.push(dayKey(new Date(last - i * 86400000).toISOString()))
    const out: string[] = []
    const step = unit === 'week' ? 7 : 1
    for (let i = dates.length - 1; i >= 0; i -= step) out.unshift(dates[Math.max(i - step + 1, 0)])
    return out
  }, [days, end, unit])
  const bucketOf = (iso: string) => {
    const key = dayKey(iso)
    let found = 0
    buckets.forEach((b, i) => {
      if (key >= b) found = i
    })
    return found
  }
  const enquirySeries = forms
    .filter((f) => !hidden.includes(f.label))
    .map((f) => {
      const values = buckets.map(() => 0)
      for (const e of current) if (e.form === f.label) values[bucketOf(e.at)]++
      return { key: f.label, label: f.label, color: colorOf(f.label), values }
    })

  const byPage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of current) counts.set(e.page, (counts.get(e.page) ?? 0) + 1)
    return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [current])
  const byWeekday = useMemo(() => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const counts = new Map(order.map((d) => [d, 0]))
    for (const e of current) counts.set(weekday(e.at), (counts.get(weekday(e.at)) ?? 0) + 1)
    return order.map((label) => ({ label, value: counts.get(label) ?? 0 }))
  }, [current])
  const busiest = [...byWeekday].sort((a, b) => b.value - a.value)[0]

  return (
    <div className="cms-reports">
      <div className="cms-seo__bar">
        <div className="cms-tabs">
          <span className="cms-tabs__tab is-active">
            Enquiries <span className="cms-tabs__count">{current.length}</span>
          </span>
          <span className="cms-info" tabIndex={0} aria-label="About these numbers">
            <Icon name="help" size={18} />
            <span className="cms-info__note" role="tooltip">
              Every form sent from the website, counted by form and by the page it was sent from. Changes compare with the period before.
            </span>
          </span>
        </div>
        <div className="cms-seo__tools">
          <div className="cms-segment" role="radiogroup" aria-label="Period">
            {periods.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={p === days} className={p === days ? 'is-active' : ''} onClick={() => go(p)}>
                {p} days
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cms-kpis">
        <Kpi label="Enquiries" value={number(current.length)} delta={<Delta value={change(current.length, before)} />} />
        <Kpi label="Top form" value={<span className="cms-kpi__text">{forms[0]?.label ?? '—'}</span>} note={forms[0] ? `${Math.round((forms[0].value / Math.max(current.length, 1)) * 100)}% of enquiries` : undefined} />
        <Kpi label="Top page" value={<span className="cms-kpi__text">{byPage[0]?.label ?? '—'}</span>} note={byPage[0] ? `${byPage[0].value} enquiries` : undefined} />
        <Kpi label="Busiest day" value={<span className="cms-kpi__text">{busiest?.value ? busiest.label : '—'}</span>} note={busiest?.value ? `${busiest.value} enquiries` : undefined} />
      </div>

      <section className="cms-card is-wide">
        <header className="cms-card__head">
          <h3>Enquiries per {unit} by form</h3>
          <span className="cms-legend">
            {forms.map((f) => (
              <button
                key={f.label}
                type="button"
                className={hidden.includes(f.label) ? 'is-off' : ''}
                aria-pressed={!hidden.includes(f.label)}
                onClick={() => setHidden((h) => (h.includes(f.label) ? h.filter((x) => x !== f.label) : [...h, f.label]))}
              >
                <i style={{ background: colorOf(f.label) }} />
                {f.label}
              </button>
            ))}
          </span>
        </header>
        <StackedBars dates={buckets} series={enquirySeries} unit={unit} />
      </section>

      <div className="cms-perf-grid">
        <Panel title="By form">
          <BarList
            rows={forms.map((f) => ({ ...f, color: colorOf(f.label) }))}
            suffix={(v) => <span className="cms-barlist__share">{Math.round((v / Math.max(current.length, 1)) * 100)}%</span>}
          />
        </Panel>
        <Panel title="Sent from">
          <BarList rows={byPage} />
        </Panel>
        <Panel title="By day of the week">
          <BarList rows={byWeekday} limit={7} />
        </Panel>
        <Panel title="Latest enquiries">
          <ul className="cms-latest">
            {current.slice(0, 6).map((e) => (
              <li key={e.id}>
                <Link href={e.href} prefetch={false}>
                  <i style={{ background: colorOf(e.form) }} />
                  <span className="cms-latest__who">
                    <strong>{e.name}</strong>
                    <span>
                      {e.form} · {e.page}
                    </span>
                  </span>
                  <span className="cms-latest__when">{ago(e.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
