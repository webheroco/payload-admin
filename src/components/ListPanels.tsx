// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Payload's own lists (Media, enquiries, anything without a view of ours)
 * open Columns and Filters in the same right-hand panel as the SEO overview,
 * instead of a strip that pushes the table down.
 *
 * Payload still owns both: this only gives the open one a heading and a
 * close button, closes it on Escape or a click outside, and starts Filters
 * with a condition to fill in rather than a separate "Add filter" step.
 * The panel's look is in styles/_lists.scss.
 *
 * Mounted once for the whole admin (admin.components.providers).
 */
import React, { useEffect } from 'react'

const PANELS = [
  { key: 'columns', title: 'Columns' },
  { key: 'where', title: 'Filters' },
] as const

const toggleOf = (key: string) => document.querySelector<HTMLButtonElement>(`.list-controls__toggle-${key}`)
const isOpen = (el: Element | null) => el?.getAttribute('aria-hidden') === 'false'

/** Give an open panel its heading and close button, once. */
function dress(panel: HTMLElement, key: string, title: string) {
  if (panel.querySelector(':scope > .cms-list-panel__head')) return
  const head = document.createElement('div')
  head.className = 'cms-list-panel__head'
  const h = document.createElement('h2')
  h.textContent = title
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'cms-list-panel__close'
  close.setAttribute('aria-label', `Close ${title.toLowerCase()}`)
  close.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  close.addEventListener('click', () => toggleOf(key)?.click())
  head.append(h, close)
  panel.prepend(head)
}

export const ListPanels: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const sync = () => {
      let anyOpen = false
      for (const { key, title } of PANELS) {
        const panel = document.querySelector<HTMLElement>(`.list-controls__${key}`)
        if (!panel) continue
        dress(panel, key, title)
        if (!isOpen(panel)) {
          panel.removeAttribute('data-started')
          continue
        }
        anyOpen = true
        // Filters opens with a condition ready to fill in.
        if (key === 'where' && !panel.dataset.started) {
          panel.dataset.started = 'true'
          panel.querySelector<HTMLButtonElement>('.where-builder__add-first-filter')?.click()
        }
      }
      document.documentElement.classList.toggle('cms-list-panel-open', anyOpen)
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-hidden'] })
    sync()

    const closeOpen = () => {
      for (const { key } of PANELS) if (isOpen(document.querySelector(`.list-controls__${key}`))) toggleOf(key)?.click()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.documentElement.classList.contains('cms-list-panel-open')) closeOpen()
    }
    const onClick = (e: MouseEvent) => {
      if (!document.documentElement.classList.contains('cms-list-panel-open')) return
      const target = e.target as Element | null
      // Inside the panel, on a toggle, or in a dropdown the panel opened (they render in a portal).
      if (!target?.isConnected || target.closest('.list-controls__columns, .list-controls__where, .search-bar__actions, .rs__menu, .popup__content, [role="listbox"], [role="dialog"]')) return
      closeOpen()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
      document.documentElement.classList.remove('cms-list-panel-open')
    }
  }, [])

  return <>{children}</>
}
