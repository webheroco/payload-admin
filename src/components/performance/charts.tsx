// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Small dependency-free charts for the Performance page. SVG, theme colours,
 * a hover readout, and they stretch to the card's width.
 */
import React, { useState } from 'react'

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const number = (n: number) => n.toLocaleString('en-GB')

type Series = { key: string; label: string; color: string; values: number[] }

/** Stacked bars over time, e.g. enquiries per day by form type. */
export const StackedBars: React.FC<{ dates: string[]; series: Series[]; height?: number; unit?: string }> = ({
  dates,
  series,
  height = 220,
  unit = 'day',
}) => {
  const [hover, setHover] = useState<number | null>(null)
  const totals = dates.map((_, i) => series.reduce((s, x) => s + x.values[i], 0))
  const max = Math.max(1, ...totals) * 1.1
  const labelEvery = Math.ceil(dates.length / 7)

  return (
    <div className="cms-chart" onMouseLeave={() => setHover(null)}>
      <div className="cms-bars" style={{ height }}>
        {dates.map((d, i) => (
          <div key={d} className={`cms-bars__col${hover === i ? ' is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
            <div className="cms-bars__stack" style={{ height: `${(totals[i] / max) * 100}%` }}>
              {series.map((s) =>
                s.values[i] ? (
                  <span key={s.key} style={{ flexGrow: s.values[i], background: s.color }} />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="cms-chart__axis">
        {dates.map((d, i) =>
          i % labelEvery === 0 ? (
            <span key={d} style={{ left: `${((i + 0.5) / dates.length) * 100}%` }}>
              {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : null,
        )}
      </div>
      {hover !== null && (
        <div className="cms-chart__tip" style={{ left: `${((hover + 0.5) / dates.length) * 100}%` }}>
          <strong>
            {unit === 'week' ? `Week of ${fmtDate(dates[hover])}` : fmtDate(dates[hover])}: {number(totals[hover])}
          </strong>
          {series
            .filter((s) => s.values[hover])
            .map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.label}
                <b>{number(s.values[hover])}</b>
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

/** A ranked list with a bar behind each row. */
export const BarList: React.FC<{
  rows: { label: string; value: number; color?: string; href?: string }[]
  limit?: number
  suffix?: (value: number) => React.ReactNode
}> = ({ rows, limit = 6, suffix }) => {
  const [all, setAll] = useState(false)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const shown = all ? rows : rows.slice(0, limit)
  return (
    <div className="cms-barlist">
      {shown.map((r) => (
        <div key={r.label} className="cms-barlist__row">
          <span className={`cms-barlist__bar${r.color ? ' has-color' : ''}`} style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          <span className="cms-barlist__label">
            {r.color && <i style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="cms-barlist__value">
            {number(r.value)}
            {suffix ? suffix(r.value) : null}
          </span>
        </div>
      ))}
      {rows.length > limit && (
        <button type="button" className="cms-barlist__more" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
      {rows.length === 0 && <p className="cms-barlist__empty">Nothing yet in this period.</p>}
    </div>
  )
}
