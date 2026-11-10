// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * A collection's description on its list, as the same "?" note the rest of
 * the admin uses, beside Create new. Payload otherwise prints it as a
 * paragraph in the top row, where a long one squeezes the search box and
 * pushes Columns and Filters into the buttons.
 *
 * Set by the plugin on every collection with `admin.description`, unless the
 * collection has its own `components.Description`.
 */
import { useTranslation } from '@payloadcms/ui'
import React from 'react'

import { Icon } from './nav/icons.js'

type Description = string | Record<string, string> | undefined

export const ListHelp: React.FC<{ description?: Description }> = ({ description }) => {
  const { i18n } = useTranslation()
  const text =
    typeof description === 'string'
      ? description
      : description
        ? (description[i18n.language] ?? Object.values(description)[0])
        : undefined
  if (!text) return null
  return (
    <span className="cms-info cms-list-help" tabIndex={0} aria-label="About this list">
      <Icon name="help" size={18} />
      <span className="cms-info__note" role="tooltip">
        {text}
      </span>
    </span>
  )
}
