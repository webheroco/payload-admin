// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * On/off settings in a list read "Yes" or "No", not Payload's `true` and
 * `false`. `invert` shows the opposite of the stored value (noIndex as "Indexed").
 */
import type { DefaultCellComponentProps } from 'payload'
import React from 'react'

export const YesNoCell: React.FC<DefaultCellComponentProps & { invert?: boolean }> = ({ cellData, invert }) => {
  const on = invert ? cellData !== true : cellData === true
  return <span className={`cms-pill${on ? ' cms-pill--good' : ''}`}>{on ? 'Yes' : 'No'}</span>
}
