// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { Button } from '@payloadcms/ui'
import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** A small centred dialog over the admin, used by the review buttons and the Reviews board. */
export const ReviewDialog: React.FC<{
  title: string
  intro: string
  confirm: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}> = ({ title, intro, confirm, busy, onConfirm, onCancel, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div className="review-dialog" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="review-dialog__box" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="review-dialog__title">{title}</h2>
        <p className="review-dialog__intro">{intro}</p>
        {children}
        <div className="review-dialog__buttons">
          <Button buttonStyle="secondary" size="medium" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button buttonStyle="primary" size="medium" onClick={onConfirm} disabled={busy}>
            {confirm}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
