// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Section palette for the Pages edit screen (a `ui` field). A column beside
 * the icon menu with a picture of every section type. Search it, hover a
 * card for a large preview, then pick the card up and drop it between two
 * sections; a click adds it at the end. Inserting uses the form's own
 * addFieldRow, exactly like "Add below", so autosave and Live Preview follow.
 */
import { useConfig, useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'


/** The blocks field the palette adds to, unless the field says otherwise. */
const DEFAULT_FIELD = 'layout'
const DRAG_THRESHOLD = 5

type PaletteBlock = { slug: string; label: string; description: string; thumbnail?: string }
type Zone = { index: number; top: number; left: number; width: number }
type Drag = { block: PaletteBlock; x: number; y: number; dx: number; dy: number; width: number }

const labelOf = (labels: unknown, fallback: string): string => {
  if (typeof labels === 'string') return labels
  if (labels && typeof labels === 'object' && 'en' in labels) return String((labels as { en: string }).en)
  return fallback
}

const findBlocksField = (fields: any[] | undefined, name: string): any => {
  for (const field of fields ?? []) {
    if (field?.type === 'blocks' && field.name === name) return field
    if (field?.type === 'tabs') {
      for (const tab of field.tabs ?? []) {
        const found = findBlocksField(tab.fields, name)
        if (found) return found
      }
    }
    if (Array.isArray(field?.fields) && !field.name) {
      const found = findBlocksField(field.fields, name)
      if (found) return found
    }
  }
  return undefined
}

export const BlockPalette: React.FC<{
  descriptions?: Record<string, string>
  /** The blocks field (top level) the sections go into. Default `layout`. (Not `field`: Payload passes that prop itself.) */
  blocksField?: string
  /** The collection whose blocks are listed. Default: the document being edited. */
  collection?: string
}> = ({ descriptions = {}, blocksField: FIELD_PATH = DEFAULT_FIELD, collection }) => {
  const { collectionSlug } = useDocumentInfo()
  const slug = collection ?? collectionSlug ?? 'pages'
  const { config } = useConfig()
  const { addFieldRow } = useForm()
  const rowCount = useFormFields(([fields]) => fields?.[FIELD_PATH]?.rows?.length ?? 0)

  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<{ block: PaletteBlock; top: number } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [target, setTarget] = useState<number | null>(null)

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const zonesRef = useRef<Zone[]>([])
  const targetRef = useRef<number | null>(null)
  const pointerY = useRef(0)

  const blocks = useMemo<PaletteBlock[]>(() => {
    const owner = config.collections.find((c) => c.slug === slug)
    const field = findBlocksField(owner?.fields as any[], FIELD_PATH)
    // Sections shared through the config's `blocks` are referenced by slug
    // (blockReferences): look those up in the config's own block library.
    const library = (config as { blocksMap?: Record<string, unknown> }).blocksMap ?? {}
    const referenced = ((field?.blockReferences ?? []) as unknown[]).map((ref) => (typeof ref === 'string' ? library[ref] : ref))
    return [...(field?.blocks ?? []), ...referenced].filter(Boolean).map((block: any) => {
      const thumb = block.admin?.images?.thumbnail ?? block.imageURL
      return {
        slug: block.slug,
        label: labelOf(block.labels?.singular, block.slug),
        description: descriptions[block.slug] ?? '',
        thumbnail: typeof thumb === 'string' ? thumb : thumb?.url,
      }
    })
  }, [config, descriptions, slug, FIELD_PATH])

  const shown = blocks.filter((b) => {
    const q = query.trim().toLowerCase()
    return !q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
  })

  useEffect(() => {
    setMounted(true)
    document.documentElement.setAttribute('data-palette', '')
    return () => document.documentElement.removeAttribute('data-palette')
  }, [])

  /** The gaps between sections, from the rows on screen. */
  const measure = useCallback(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[id^="${FIELD_PATH}-row-"]`)).filter((el) =>
      /-row-\d+$/.test(el.id),
    )
    let next: Zone[] = []
    if (rows.length === 0) {
      const anchor = document.querySelector<HTMLElement>('.blocks-field')
      if (anchor) {
        const r = anchor.getBoundingClientRect()
        next = [{ index: 0, top: r.bottom - 20, left: r.left, width: r.width }]
      }
    } else {
      const rects = rows.map((el) => el.getBoundingClientRect())
      for (let i = 0; i <= rects.length; i++) {
        const above = rects[i - 1]
        const below = rects[i]
        const top = !above ? below.top - 7 : !below ? above.bottom + 7 : (above.bottom + below.top) / 2
        const ref = below ?? above
        next.push({ index: i, top, left: ref.left, width: ref.width })
      }
    }
    zonesRef.current = next
    setZones(next)
  }, [])

  const pickTarget = useCallback((y: number) => {
    let best: number | null = null
    let distance = Infinity
    for (const zone of zonesRef.current) {
      const d = Math.abs(zone.top - y)
      if (d < distance) {
        distance = d
        best = zone.index
      }
    }
    targetRef.current = best
    setTarget(best)
  }, [])

  const openContentTab = () => {
    if (document.querySelector('.blocks-field')) return
    Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs-field__tab-button'))
      .find((b) => b.textContent?.trim() === 'Content')
      ?.click()
  }

  /** After autosave refreshes Live Preview, scroll it to the new section. */
  const revealInPreview = (index: number, expected: number) => {
    let tries = 0
    const tick = () => {
      const frame = document.querySelector<HTMLIFrameElement>('.live-preview-iframe, iframe')
      let sections: NodeListOf<HTMLElement> | undefined
      try {
        sections = frame?.contentDocument?.querySelectorAll<HTMLElement>('[data-block-type]')
      } catch {
        return
      }
      const el = sections && sections.length >= expected ? sections[index] : undefined
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '3px solid #2f7cf6'
        el.style.outlineOffset = '6px'
        setTimeout(() => (el.style.outline = ''), 2000)
      } else if (++tries < 60) setTimeout(tick, 150)
    }
    tick()
  }

  const insert = useCallback(
    (slug: string, index: number) => {
      const expected = rowCount + 1
      addFieldRow({ blockType: slug, path: FIELD_PATH, rowIndex: index, schemaPath: FIELD_PATH })
      setTimeout(() => {
        document.getElementById(`${FIELD_PATH}-row-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
      revealInPreview(index, expected)
    },
    [addFieldRow, rowCount],
  )

  // Keep the page scrolling while a card is held near the top or bottom edge.
  useEffect(() => {
    if (!drag) return
    let frame = 0
    const step = () => {
      const y = pointerY.current
      const edge = 90
      const speed = y < edge ? -(edge - y) / 4 : y > window.innerHeight - edge ? (y - (window.innerHeight - edge)) / 4 : 0
      if (speed) {
        window.scrollBy(0, speed)
        measure()
        pickTarget(y)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [drag, measure, pickTarget])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, block: PaletteBlock) => {
    if (e.button !== 0) return
    e.preventDefault()
    const card = e.currentTarget.getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY }
    let dragging = false

    const move = (ev: PointerEvent) => {
      pointerY.current = ev.clientY
      if (!dragging) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return
        dragging = true
        setPreview(null)
        openContentTab()
        document.documentElement.setAttribute('data-palette-dragging', '')
        requestAnimationFrame(() => requestAnimationFrame(measure))
      }
      const next = {
        block,
        x: ev.clientX,
        y: ev.clientY,
        dx: start.x - card.left,
        dy: start.y - card.top,
        width: card.width,
      }
      dragRef.current = next
      setDrag(next)
      pickTarget(ev.clientY)
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.documentElement.removeAttribute('data-palette-dragging')
      if (dragging) {
        const index = targetRef.current
        if (index !== null) insert(block.slug, index)
      } else {
        insert(block.slug, rowCount) // a click adds it at the end
      }
      dragRef.current = null
      targetRef.current = null
      setDrag(null)
      setTarget(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const showPreview = (e: React.MouseEvent<HTMLDivElement>, block: PaletteBlock) => {
    if (dragRef.current) return
    const top = e.currentTarget.getBoundingClientRect().top
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setPreview({ block, top }), 350)
  }
  const hidePreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setPreview(null)
  }

  if (!mounted) return null

  // Beside the menu, in the same layer, so the menu can slide out over it.
  const host = document.querySelector<HTMLElement>('.template-default') ?? document.body

  return createPortal(
    <>
      <aside className="cms-palette" aria-label="Sections you can add">
        <div className="cms-palette__head">
          <h3>Add a section</h3>
          <input
            className="cms-input cms-palette__search"
            type="search"
            placeholder="Search sections"
            aria-label="Search sections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="cms-palette__list">
          {shown.map((block) => (
            <li key={block.slug}>
              <div
                className={`cms-palette__card${drag?.block.slug === block.slug ? ' is-lifted' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Add ${block.label}`}
                onPointerDown={(e) => onPointerDown(e, block)}
                onMouseEnter={(e) => showPreview(e, block)}
                onMouseLeave={hidePreview}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    insert(block.slug, rowCount)
                  }
                }}
              >
                <div className="cms-palette__thumb">
                  {block.thumbnail ? <img src={block.thumbnail} alt="" draggable={false} /> : null}
                </div>
                <div className="cms-palette__text">
                  <strong>{block.label}</strong>
                  {block.description ? <span>{block.description}</span> : null}
                </div>
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="cms-palette__empty">No sections match “{query}”.</li>}
        </ul>
        <p className="cms-palette__hint">Drag a section into the page, or click to add it at the end.</p>
      </aside>

      {preview && !drag && (
        <div className="cms-palette__preview" style={{ top: Math.min(preview.top, window.innerHeight - 420) }} aria-hidden>
          {preview.block.thumbnail ? <img src={preview.block.thumbnail} alt="" /> : null}
          <strong>{preview.block.label}</strong>
          {preview.block.description ? <span>{preview.block.description}</span> : null}
        </div>
      )}

      {drag && (
        <>
          {zones.map((zone) => (
            <div
              key={zone.index}
              className={`cms-palette__zone${target === zone.index ? ' is-target' : ''}`}
              style={{ top: zone.top, left: zone.left, width: zone.width }}
            >
              {target === zone.index ? <span>Drop {drag.block.label} here</span> : null}
            </div>
          ))}
          <div
            className="cms-palette__ghost"
            style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width }}
            aria-hidden
          >
            <div className="cms-palette__thumb">
              {drag.block.thumbnail ? <img src={drag.block.thumbnail} alt="" /> : null}
            </div>
            <div className="cms-palette__text">
              <strong>{drag.block.label}</strong>
            </div>
          </div>
        </>
      )}
    </>,
    host,
  )
}
