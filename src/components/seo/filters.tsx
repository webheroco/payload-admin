// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import React, { useEffect } from 'react'

/** A side panel from the right for filters that don't need to be on screen all the time. */
export const FilterPanel: React.FC<{ open: boolean; onClose: () => void; onClear: () => void; children: React.ReactNode }> = ({
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
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
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

export const Choice: React.FC<{
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

