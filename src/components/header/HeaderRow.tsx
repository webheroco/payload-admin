// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Puts the document's controls (status, Versions, preview, Publish) in the
 * top bar, between the breadcrumb and the menus, instead of a second bar
 * under it. Renders nothing: it measures where the breadcrumb ends and the
 * menus start, hands that room to .doc-controls as padding, and turns the
 * one-row layout on (html.cms-headrow) only when everything fits. Otherwise,
 * and on screens up to 1024px, the controls keep their own row.
 * Register it in admin.components.actions.
 */
import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'

const GAP = 20
const WIDE = 1024

export const HeaderRow: React.FC = () => {
  const pathname = usePathname()

  useLayoutEffect(() => {
    const root = document.documentElement
    const watched = new Set<Element>()
    let frame = 0
    let tries = 0

    const observer = new ResizeObserver(() => schedule())
    const watch = (el: Element | null | undefined) => {
      if (el && !watched.has(el)) {
        watched.add(el)
        observer.observe(el)
      }
    }

    const measure = () => {
      const controls = document.querySelector<HTMLElement>('.doc-controls:not(.drawer *)')
      const crumb = document.querySelector('.app-header .step-nav')
      const actions = document.querySelector('.app-header__actions')
      const meta = controls?.querySelector('.doc-controls__meta')
      const buttons = controls?.querySelector('.doc-controls__controls')
      if (!controls || !crumb || !actions || !buttons) {
        root.classList.remove('cms-headrow')
        // The document view mounts after the route changes; look again briefly.
        if (tries++ < 60) frame = requestAnimationFrame(measure)
        return
      }
      ;[controls, crumb, actions, meta, buttons].forEach(watch)
      const box = controls.getBoundingClientRect()
      const left = Math.round(crumb.getBoundingClientRect().right - box.left + GAP)
      const right = Math.round(box.right - actions.getBoundingClientRect().left + GAP)
      const status = [...(meta?.children ?? [])].reduce((sum, li) => sum + li.getBoundingClientRect().width + 8, 0)
      const needed = status + buttons.getBoundingClientRect().width + GAP
      controls.style.setProperty('--cms-row-left', `${left}px`)
      controls.style.setProperty('--cms-row-right', `${right}px`)
      root.classList.toggle('cms-headrow', window.innerWidth > WIDE && box.width - left - right >= needed)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      root.classList.remove('cms-headrow')
    }
  }, [pathname])

  return null
}
