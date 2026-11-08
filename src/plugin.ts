/**
 * `webheroAdmin()`: the WebHero admin in one plugin. It must be the LAST entry
 * in `plugins`, so collections added by the plugins before it get the
 * defaults too.
 *
 * It sets the icon rail menu, the top-right menus (language, guide, account)
 * and the one-row document header, adds the SEO overview, Performance and
 * guide pages, and applies the admin defaults (defaults.ts). Anything the
 * project already set itself (a Nav, a view at the same key) is kept.
 */
import type { Config, Plugin } from 'payload'

import { withApprovals } from './approvals.js'
import { collectionDefaults, globalDefaults } from './defaults.js'
import { resolveOptions, type WebheroAdminOptions } from './options.js'
import { ACCOUNT_MENU, GUIDE, HEADER_ROW, HELP_BUTTON, LANGUAGE_MENU, NAV_RAIL, PERFORMANCE, PERFORMANCE_HOME, REVIEWS, SEO_OVERVIEW } from './paths.js'

/** Payload draws actions in reverse, so these read language, ?, picture. */
const ACTIONS = [ACCOUNT_MENU, HELP_BUTTON, LANGUAGE_MENU, HEADER_ROW]

export const webheroAdmin =
  (options: WebheroAdminOptions = {}): Plugin =>
  (input: Config): Config => {
    const slugs = new Set((input.collections ?? []).map((c) => c.slug))
    const resolved = resolveOptions(options, slugs)
    // Approvals (optional) wrap the collections and globals with drafts and add Reviews.
    const config = resolved.approvals ? withApprovals(input, resolved.approvals) : input
    const previewControls = options.previewControls ?? []
    const admin = config.admin ?? {}
    const components = admin.components ?? {}
    const ownActions = (components.actions ?? []).filter(
      (a) => !ACTIONS.includes(typeof a === 'string' ? a : (a as { path?: string })?.path ?? ''),
    )

    return {
      ...config,
      admin: {
        ...admin,
        custom: { ...admin.custom, webheroAdmin: resolved },
        components: {
          ...components,
          Nav: components.Nav ?? NAV_RAIL,
          actions: [...ACTIONS, ...ownActions],
          views: {
            ...(resolved.views.seo ? { seoOverview: { Component: SEO_OVERVIEW, path: '/seo' as const } } : {}),
            // Performance is the admin's home (the dashboard view), or its own page at /performance.
            ...(resolved.home === 'performance'
              ? { dashboard: { Component: PERFORMANCE_HOME } }
              : resolved.views.performance
                ? { performance: { Component: PERFORMANCE, path: '/performance' as const } }
                : {}),
            ...(resolved.views.guide ? { guide: { Component: GUIDE, path: '/guide' as const } } : {}),
            ...(resolved.approvals ? { reviews: { Component: REVIEWS, path: '/reviews' as const } } : {}),
            ...components.views,
          },
        },
      },
      collections: config.collections?.map((c) => collectionDefaults(c, resolved, previewControls)),
      globals: config.globals?.map((g) => globalDefaults(g, resolved, previewControls)),
    }
  }
