// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The "i" note beside Save on a collection or global without drafts (Media,
 * Team), where there is no status group to hold it. Same note as DocStatus:
 * the dates, then how saving works there, so nothing pushes the form down.
 */
import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

import { Icon } from '../nav/icons.js'

const when = (value: unknown) => {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const SaveNote: React.FC<{ help?: string }> = ({ help }) => {
  const { savedDocumentData } = useDocumentInfo()
  if (!help) return null
  return (
    <div className="cms-status cms-status--note">
      <span className="cms-info cms-status__info" tabIndex={0} aria-label="Dates and saving">
        <Icon name="help" size={18} />
        <span className="cms-info__note" role="tooltip">
          {savedDocumentData?.updatedAt ? (
            <dl>
              <dt>Last changed</dt>
              <dd>{when(savedDocumentData.updatedAt)}</dd>
              <dt>Created</dt>
              <dd>{when(savedDocumentData.createdAt)}</dd>
            </dl>
          ) : null}
          <p className="cms-status__help">{help}</p>
        </span>
      </span>
    </div>
  )
}
