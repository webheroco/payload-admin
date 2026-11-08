// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * The admin menu (admin.components.Nav). Same entities, groups and
 * permissions as Payload's own menu, drawn as a rail that collapses to icons.
 */
import type { ServerProps, VisibleEntities } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { EntityType, groupNavItems } from '@payloadcms/ui/shared'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'
import { SETTINGS_GROUP } from '../header/AccountMenu.js'
import { iconFor } from './icons.js'
import { NavRailClient, type RailGroup } from './NavRail.client.js'

export const NavRail = async (props: ServerProps & { visibleEntities?: VisibleEntities }) => {
  const { i18n, locale, params, payload, permissions, searchParams, user, visibleEntities } = props
  if (!payload?.config || !visibleEntities) return null
  const { collections, globals, routes } = payload.config
  const adminRoute = routes.admin
  const { views, home, approvals } = readOptions(payload.config)

  const groups = groupNavItems(
    [
      ...collections
        .filter(({ slug }) => visibleEntities.collections.includes(slug))
        .map((entity) => ({ type: EntityType.collection as const, entity })),
      ...globals
        .filter(({ slug }) => visibleEntities.globals.includes(slug))
        .map((entity) => ({ type: EntityType.global as const, entity })),
    ],
    permissions!,
    i18n,
  )

  // Settings (Admin users, Sites) live in the account menu top right, not here.
  const ordered = groups.filter((group) => group.label !== SETTINGS_GROUP)

  const railGroups: RailGroup[] = ordered.map((group) => ({
    label: group.label,
    items: group.entities.map((entity) => {
      const isCollection = entity.type === EntityType.collection
      const config = isCollection
        ? collections.find((c) => c.slug === entity.slug)
        : globals.find((g) => g.slug === entity.slug)
      return {
        slug: entity.slug,
        label: getTranslation(entity.label, i18n),
        href: formatAdminURL({
          adminRoute,
          path: isCollection ? `/collections/${entity.slug}` : `/globals/${entity.slug}`,
        }),
        icon: iconFor(entity.slug, config?.admin?.custom?.navIcon),
      }
    }),
  }))

  return (
    <NavRailClient
      adminRoute={adminRoute}
      groups={railGroups}
      // A custom Nav replaces Payload's, beforeNavLinks included, so render it
      // here: on multi-site, SiteMenu and TenantDefault live there (the
      // plugin's own selector is hidden by the i18n styles).
      beforeLinks={RenderServerComponent({
        Component: payload.config.admin?.components?.beforeNavLinks,
        importMap: payload.importMap,
        serverProps: { i18n, locale, params, payload, permissions, searchParams, user },
      })}
      home={home}
      performanceHref={
        home === 'performance'
          ? adminRoute
          : views.performance
            ? formatAdminURL({ adminRoute, path: '/performance' })
            : undefined
      }
      seoHref={views.seo ? formatAdminURL({ adminRoute, path: '/seo' }) : undefined}
      reviewsHref={approvals ? formatAdminURL({ adminRoute, path: '/reviews' }) : undefined}
    />
  )
}
