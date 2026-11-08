// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { Icon } from './icons.js'

export type RailItem = { slug: string; label: string; href: string; icon: string }
export type RailGroup = { label: string; items: RailItem[] }

const STORAGE_KEY = 'cms-rail-collapsed'

/** The rail can only be held open on wide screens without the section palette. */
const canPin = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(min-width: 1025px)').matches &&
  !document.documentElement.hasAttribute('data-palette')

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** One menu row: icon always, label beside it or (collapsed) in a hover tip. */
const RailLink: React.FC<{ href: string; icon: string; label: string; active: boolean }> = ({
  href,
  icon,
  label,
  active,
}) => (
  <Link
    href={href}
    prefetch={false}
    className={`cms-rail__link${active ? ' is-active' : ''}`}
    aria-current={active ? 'page' : undefined}
    data-tip={label}
  >
    <Icon name={icon} />
    <span className="cms-rail__text">{label}</span>
  </Link>
)

export const NavRailClient: React.FC<{
  groups: RailGroup[]
  adminRoute: string
  /** Left out when the project turned the SEO overview off. */
  seoHref?: string
  /** Left out when the project turned Performance off. */
  performanceHref?: string
  /** 'performance': Performance is the home page, so there is no Dashboard link. */
  home?: 'performance' | 'dashboard'
  /** Whatever the config puts in beforeNavLinks: on multi-site, SiteMenu and TenantDefault. */
  beforeLinks?: React.ReactNode
}> = ({ groups, adminRoute, seoHref, performanceHref, home, beforeLinks }) => {
  const pathname = usePathname() ?? ''
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => setCollapsed(readCollapsed()), [])
  useEffect(() => {
    document.documentElement.dataset.rail = collapsed ? 'collapsed' : 'open'
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // per-viewer convenience only
    }
  }, [collapsed])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  return (
    <aside className={`cms-rail${collapsed ? ' is-collapsed' : ''}`} aria-label="Main menu">
      <div className="cms-rail__top">
        <Link
          href={adminRoute}
          prefetch={false}
          className="cms-rail__logo"
          aria-label={collapsed ? 'Open menu' : 'Home'}
          data-tip={collapsed ? 'Open menu' : 'Home'}
          onClick={(event) => {
            // Collapsed, the logo opens the menu. Where the rail is always icons
            // (narrow screens, the section palette) it goes to the dashboard.
            if (collapsed && canPin()) {
              event.preventDefault()
              setCollapsed(false)
            }
          }}
        >
          {/* Replace with the client's logo mark. */}
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M9 22V10h7a4 4 0 0 1 0 8h-7M16 18l6 4" stroke="var(--theme-bg)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        {/* On multi-site the site menu takes the logo's place (the CSS hides the logo when it is there). */}
        {beforeLinks}
        {/* An icon at the right of the open menu. Collapsed, there is none: the logo or the edge opens it. */}
        <button
          type="button"
          className="cms-rail__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Keep menu open' : 'Collapse menu'}
          data-tip={collapsed ? 'Keep menu open' : 'Collapse menu'}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={18} />
        </button>
      </div>

      <nav className="cms-rail__scroll">
        <div className="cms-rail__group">
          {home === 'performance' ? null : (
            <RailLink href={adminRoute} icon="home" label="Dashboard" active={pathname === adminRoute} />
          )}
          {performanceHref ? (
            <RailLink
              href={performanceHref}
              icon="chart"
              label="Performance"
              active={performanceHref === adminRoute ? pathname === adminRoute : isActive(performanceHref)}
            />
          ) : null}
          {seoHref ? <RailLink href={seoHref} icon="seo" label="SEO overview" active={isActive(seoHref)} /> : null}
        </div>
        {groups.map((group) => (
          // No group headings: the menu keeps the same shape open and collapsed, so nothing jumps.
          <div className="cms-rail__group" key={group.label} aria-label={group.label} role="group">
            {group.items.map((item) => (
              <RailLink key={item.slug} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} />
            ))}
          </div>
        ))}
      </nav>

    </aside>
  )
}
