// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { Choice, FilterPanel } from '../seo/filters.js'
import { Icon } from '../nav/icons.js'

export type SectionCard = {
  slug: string
  label: string
  group: string
  description: string
  thumbnail?: string
  pages: { title: string; href: string }[]
}

const DEFAULTS = { group: 'all', use: 'all' }

export const SectionsClient: React.FC<{ sections: SectionCard[] }> = ({ sections }) => {
  const { setStepNav } = useStepNav()
  useEffect(() => setStepNav([{ label: 'Sections' }]), [setStepNav])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(DEFAULTS)
  const [panel, setPanel] = useState(false)
  const set = (key: keyof typeof DEFAULTS) => (value: string) => setFilters((f) => ({ ...f, [key]: value }))

  const groups = [...new Set(sections.map((s) => s.group).filter(Boolean))]
  const activeFilters = Object.values(filters).filter((v) => v !== 'all').length
  const q = query.trim().toLowerCase()
  const visible = sections.filter((s) => {
    if (filters.group !== 'all' && s.group !== filters.group) return false
    if (filters.use === 'used' && !s.pages.length) return false
    if (filters.use === 'unused' && s.pages.length) return false
    return !q || [s.label, s.description, s.group, ...s.pages.map((p) => p.title)].some((t) => t.toLowerCase().includes(q))
  })

  return (
    <div className="cms-seo cms-sections">
      <div className="cms-seo__bar">
        <div className="cms-tabs" role="tablist">
          <span className="cms-tabs__tab is-active">
            Sections <span className="cms-tabs__count">{sections.length}</span>
          </span>
          <span className="cms-info" tabIndex={0} aria-label="About this page">
            <Icon name="help" size={18} />
            <span className="cms-info__note" role="tooltip">
              Every section the website can use, and the pages using it. Add, reorder and fill sections on any page with
              “Add a section” in the page editor. A new kind of section, or a change to how one looks, is built by your
              developer.
            </span>
          </span>
        </div>
        <div className="cms-seo__tools">
          <input
            className="cms-input cms-seo__search"
            type="search"
            placeholder="Search sections"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className={`cms-button cms-button--outline${activeFilters ? ' is-active' : ''}`} onClick={() => setPanel(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filters{activeFilters ? <span className="cms-button__badge">{activeFilters}</span> : null}
          </button>
        </div>
      </div>

      <div className="cms-sections__grid">
        {visible.map((s) => (
          <article key={s.slug} className="cms-sections__card">
            <div className="cms-sections__thumb">
              {s.thumbnail ? <img src={s.thumbnail} alt="" loading="lazy" /> : <span aria-hidden="true">{s.label.slice(0, 1)}</span>}
            </div>
            <div className="cms-sections__body">
              <h2 className="cms-sections__name">{s.label}</h2>
              {s.description ? <p className="cms-sections__desc">{s.description}</p> : null}
              <p className="cms-sections__meta">
                {s.group ? `${s.group} · ` : ''}
                {s.pages.length ? `On ${s.pages.length} ${s.pages.length === 1 ? 'page' : 'pages'}` : 'Not used yet'}
              </p>
              {s.pages.length ? (
                <ul className="cms-sections__pages">
                  {s.pages.slice(0, 4).map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false}>
                        {p.title}
                      </Link>
                    </li>
                  ))}
                  {s.pages.length > 4 ? <li>and {s.pages.length - 4} more</li> : null}
                </ul>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && <p className="cms-seo__empty">Nothing matches. Try clearing the search or filters.</p>}

      <FilterPanel open={panel} onClose={() => setPanel(false)} onClear={() => setFilters(DEFAULTS)}>
        {groups.length > 1 ? (
          <Choice
            legend="Group"
            value={filters.group}
            onChange={set('group')}
            options={[{ value: 'all', label: 'All groups' }, ...groups.map((g) => ({ value: g, label: g, count: sections.filter((s) => s.group === g).length }))]}
          />
        ) : null}
        <Choice
          legend="Use"
          value={filters.use}
          onChange={set('use')}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'used', label: 'Used on a page', count: sections.filter((s) => s.pages.length).length },
            { value: 'unused', label: 'Not used yet', count: sections.filter((s) => !s.pages.length).length },
          ]}
        />
      </FilterPanel>
    </div>
  )
}
