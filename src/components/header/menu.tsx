// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Shared pieces for the admin's dropdowns: the site menu at the top of the
 * rail and the language and account menus top right. One look, one
 * behaviour: click to open, Esc or a click outside closes, arrow keys move.
 */
import { useConfig } from '@payloadcms/ui'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '../nav/icons.js'

export const useMenu = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-menu-item]:not(:disabled)') ?? [])
        if (!items.length) return
        e.preventDefault()
        const i = items.indexOf(document.activeElement as HTMLElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  return { open, setOpen, toggle, ref }
}

/** A search box that only appears when the list is long enough to need one. */
export const useFilter = <T,>(items: T[], text: (item: T) => string, threshold = 7) => {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? items.filter((i) => text(i).toLowerCase().includes(q)) : items
  const box =
    items.length >= threshold ? (
      <div className="cms-menu__search">
        <Icon name="search" size={16} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search the list"
        />
      </div>
    ) : null
  return { shown, box, reset: () => setQuery('') }
}

export const initials = (label: string) => {
  const words = label.split(/[\s@._-]+/).filter((w) => /^[A-Za-z0-9]/.test(w))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** A square mark: the image when there is one, otherwise initials on a colour picked from the name. */
export const Mark: React.FC<{ label: string; src?: string | null; size?: number; round?: boolean }> = ({
  label,
  src,
  size = 28,
  round,
}) => {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    // An image that failed before React attached onError (it was in the
    // server's HTML) never calls it, so check once on mount as well.
    const el = img.current
    setFailed(Boolean(el && el.complete && el.naturalWidth === 0))
  }, [src])
  const hue = [...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  const style = { width: size, height: size, borderRadius: round ? '50%' : Math.round(size / 4) }
  if (src && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={img} className="cms-mark is-image" src={src} alt="" style={style} onError={() => setFailed(true)} />
    )
  return (
    <span
      className="cms-mark"
      aria-hidden="true"
      style={{ ...style, fontSize: Math.round(size * 0.38), background: `hsl(${hue} 45% 42%)` }}
    >
      {initials(label)}
    </span>
  )
}

export type Site = { id: string | number; name: string; domain?: string | null; logo?: string | null }

/** The REST API's base, from the config (routes.api may not be /api). */
export const useApiURL = () => {
  const { config } = useConfig()
  return `${config.serverURL ?? ''}${config.routes.api}`
}

let sitesCache: Promise<Site[]> | null = null

/** Every site with its domain and logo, fetched once per admin session. */
export const useSites = () => {
  const api = useApiURL()
  const [sites, setSites] = useState<Site[]>([])
  useEffect(() => {
    sitesCache ??= fetch(`${api}/tenants?limit=100&depth=1&sort=name`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d) =>
        (d.docs ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          // Multi-site templates store `origin` (https://www.example.co.uk); a plain `domain` works too.
          domain: t.domain ?? (t.origin ? new URL(t.origin).hostname.replace(/^www\./, '') : null),
          logo: typeof t.logo === 'object' ? (t.logo?.sizes?.thumbnail?.url ?? t.logo?.url) : null,
        })),
      )
      .catch(() => [])
    let live = true
    sitesCache.then((s) => live && setSites(s))
    return () => {
      live = false
    }
  }, [api])
  return sites
}
