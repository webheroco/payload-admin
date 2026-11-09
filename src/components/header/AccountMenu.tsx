// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * The account menu (admin.components.actions). Works out, on the server,
 * which Settings screens this person may open: every collection and global
 * in the "Settings" group that they can read and that isn't hidden from them.
 * The rail leaves that group out, so settings live here, top right.
 */
import type { ServerProps } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { iconFor } from '../nav/icons.js'
import { AccountMenuClient, type SettingsLink } from './AccountMenu.client.js'

export const SETTINGS_GROUP = 'Settings'

export const AccountMenu = (props: ServerProps) => {
  const { i18n, payload, permissions, user } = props
  if (!payload?.config) return null
  const adminRoute = payload.config.routes.admin
  const isHidden = (hidden: unknown) => (typeof hidden === 'function' ? Boolean(hidden({ user })) : Boolean(hidden))
  const groupOf = (group: unknown) => (group ? getTranslation(group as string, i18n) : '')

  const settings: SettingsLink[] = [
    ...payload.config.collections
      .filter((c) => groupOf(c.admin?.group) === SETTINGS_GROUP && !isHidden(c.admin?.hidden))
      .filter((c) => permissions?.collections?.[c.slug]?.read)
      .map((c) => ({
        slug: c.slug,
        label: getTranslation(c.labels.plural, i18n),
        href: formatAdminURL({ adminRoute, path: `/collections/${c.slug}` }),
        icon: iconFor(c.slug, c.admin?.custom?.navIcon),
      })),
    ...payload.config.globals
      .filter((g) => groupOf(g.admin?.group) === SETTINGS_GROUP && !isHidden(g.admin?.hidden))
      .filter((g) => permissions?.globals?.[g.slug]?.read)
      .map((g) => ({
        slug: g.slug,
        label: getTranslation(g.label, i18n),
        href: formatAdminURL({ adminRoute, path: `/globals/${g.slug}` }),
        icon: iconFor(g.slug, g.admin?.custom?.navIcon),
      })),
  ]

  return <AccountMenuClient settings={settings} />
}
