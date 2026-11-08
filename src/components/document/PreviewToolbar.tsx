// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Live Preview size controls (admin.components.edit.beforeDocumentControls).
 * Icon buttons for phone, tablet, laptop and "fit", plus "Custom" for exact
 * sizes, drawn inside Payload's preview toolbar. Payload's own breakpoint
 * menu is hidden; its size and zoom inputs show only under Custom.
 *
 * It also opens Live Preview the first time a document is edited.
 */
import { useDocumentInfo, useLivePreviewContext, usePreferences } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const DEVICES = [
  { name: 'mobile', label: 'Phone', icon: <rect x="7" y="2" width="10" height="20" rx="2" /> },
  { name: 'tablet', label: 'Tablet', icon: <rect x="4" y="2" width="16" height="20" rx="2" /> },
  {
    name: 'desktop',
    label: 'Laptop',
    icon: (
      <>
        <rect x="4" y="4" width="16" height="11" rx="1.5" />
        <path d="M2 19h20" />
      </>
    ),
  },
  {
    name: 'responsive',
    label: 'Fit to panel',
    icon: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  },
] as const

function useLivePreviewByDefault() {
  const { collectionSlug, globalSlug } = useDocumentInfo()
  const { isLivePreviewEnabled, isLivePreviewing, setIsLivePreviewing } = useLivePreviewContext()
  const { getPreference } = usePreferences()
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || !isLivePreviewEnabled || isLivePreviewing) return
    const key = collectionSlug ? `collection-${collectionSlug}` : globalSlug ? `global-${globalSlug}` : null
    if (!key) return
    asked.current = true
    void getPreference<{ editViewType?: string }>(key).then((stored) => {
      if (stored?.editViewType === undefined) setIsLivePreviewing(true)
    })
  }, [collectionSlug, getPreference, globalSlug, isLivePreviewEnabled, isLivePreviewing, setIsLivePreviewing])
}

export const PreviewToolbar: React.FC = () => {
  const { breakpoint, isLivePreviewing, setBreakpoint } = useLivePreviewContext()
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLivePreviewByDefault()

  // The toolbar renders after the preview opens; wait for it.
  useEffect(() => {
    if (!isLivePreviewing) return setHost(null)
    let frame = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>('.live-preview-toolbar')
      if (el) setHost(el)
      else frame = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(frame)
  }, [isLivePreviewing])

  useEffect(() => {
    host?.toggleAttribute('data-custom', breakpoint === 'custom')
  }, [breakpoint, host])

  if (!host) return null

  return createPortal(
    <div className="cms-preview-sizes" role="group" aria-label="Preview size">
      {DEVICES.map((device) => {
        const active = breakpoint === device.name
        return (
          <button
            key={device.name}
            type="button"
            className={`cms-preview-sizes__button${active ? ' is-active' : ''}`}
            aria-pressed={active}
            aria-label={device.label}
            data-tip={device.label}
            onClick={() => setBreakpoint(device.name)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {device.icon}
            </svg>
          </button>
        )
      })}
      <button
        type="button"
        className={`cms-preview-sizes__custom${breakpoint === 'custom' ? ' is-active' : ''}`}
        aria-pressed={breakpoint === 'custom'}
        onClick={() => setBreakpoint(breakpoint === 'custom' ? 'responsive' : 'custom')}
      >
        Custom
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d={breakpoint === 'custom' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>
    </div>,
    host,
  )
}
