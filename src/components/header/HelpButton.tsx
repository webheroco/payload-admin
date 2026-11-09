// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Top right, beside the language: a "?" that opens the guide to using the
 * admin (admin.components.views.guide, path /guide).
 */
import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { Icon } from '../nav/icons.js'

export const HelpButton: React.FC = () => {
  const { config } = useConfig()
  const pathname = usePathname() ?? ''
  const href = `${config.routes.admin}/guide`
  return (
    <Link
      href={href}
      prefetch={false}
      className={`cms-headbutton is-icon${pathname === href ? ' is-active' : ''}`}
      aria-label="How to use the admin"
      data-tip="How to use the admin"
    >
      <Icon name="help" size={18} />
    </Link>
  )
}
