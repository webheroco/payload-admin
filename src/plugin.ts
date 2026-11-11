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
import { ACCOUNT_MENU, GUIDE, HEADER_ROW, HELP_BUTTON, LANGUAGE_MENU, LIST_PANELS, NAV_RAIL, PERFORMANCE, PERFORMANCE_HOME, REVIEWS, SECTIONS, SEO_OVERVIEW } from './paths.js'

/**
 * Payload's list wording in plain words. An empty list reads the same whether
 * nothing exists yet or a search found nothing, so it says both, briefly.
 */
const WORDING = {
  en: {
    general: {
      noResultsFound: 'Nothing to show.',
      noResultsDescription: 'Nothing has been added yet, or nothing matches your search or filters.',
    },
  },
}

/**
 * Payload draws actions in reverse, so these read language, picture. The guide
 * is the last item in the menu, so there is no second "?" up here.
 */
const ACTIONS = [ACCOUNT_MENU, LANGUAGE_MENU, HEADER_ROW]
/** Older versions put the guide's "?" here: sites that copied it get it taken out. */
const RETIRED = [HELP_BUTTON]

const SECTIONS_LIMIT = 100

/** How many kinds of section (blocks) the config defines, shared or inline. */
export function blockTypeCount(config: Config): number {
  const slugs = new Set<string>((config.blocks ?? []).map((b) => b.slug))
  const walk = (fields: unknown[] | undefined) => {
    for (const f of (fields ?? []) as any[]) {
      if (f?.type === 'blocks') {
        for (const b of f.blocks ?? []) {
          slugs.add(b.slug)
          walk(b.fields)
        }
        for (const ref of f.blockReferences ?? []) slugs.add(typeof ref === 'string' ? ref : ref.slug)
      }
      if (f?.type === 'tabs') for (const t of f.tabs ?? []) walk(t.fields)
      if (Array.isArray(f?.fields)) walk(f.fields)
    }
  }
  for (const c of config.collections ?? []) walk(c.fields)
  for (const g of config.globals ?? []) walk(g.fields)
  return slugs.size
}

export const webheroAdmin =
  (options: WebheroAdminOptions = {}): Plugin =>
  (input: Config): Config => {
    const slugs = new Set((input.collections ?? []).map((c) => c.slug))
    const resolved = resolveOptions(options, slugs)
    // Sections reads every kind of section a page can hold. With a few hundred
    // kinds that is one of the heaviest reads in the admin, so on a big site
    // the page is off unless the site asks for it.
    if (options.views?.sections === undefined && blockTypeCount(input) > SECTIONS_LIMIT) resolved.views.sections = false
    // Approvals (optional) wrap the collections and globals with drafts and add Reviews.
    const config = resolved.approvals ? withApprovals(input, resolved.approvals) : input
    const previewControls = options.previewControls ?? []
    const admin = config.admin ?? {}
    const components = admin.components ?? {}
    const ownActions = (components.actions ?? []).filter(
      (a) => {
        const path = typeof a === 'string' ? a : ((a as { path?: string })?.path ?? '')
        return !ACTIONS.includes(path) && !RETIRED.includes(path)
      },
    )

    const providers = components.providers ?? []
    const translations = (config.i18n?.translations ?? {}) as Record<string, Record<string, Record<string, string>>>
    return {
      ...config,
      // The site's own wording wins over ours.
      i18n: {
        ...config.i18n,
        translations: {
          ...translations,
          en: { ...translations.en, general: { ...WORDING.en.general, ...translations.en?.general } },
        } as any,
      },
      admin: {
        ...admin,
        custom: { ...admin.custom, webheroAdmin: resolved },
        components: {
          ...components,
          Nav: components.Nav ?? NAV_RAIL,
          actions: [...ACTIONS, ...ownActions],
          // Columns and Filters on Payload's own lists open in the right-hand panel.
          providers: providers.includes(LIST_PANELS) ? providers : [LIST_PANELS, ...providers],
          views: {
            ...(resolved.views.seo ? { seoOverview: { Component: SEO_OVERVIEW, path: '/seo' as const } } : {}),
            // Performance is the admin's home (the dashboard view), or its own page at /performance.
            ...(resolved.home === 'performance'
              ? { dashboard: { Component: PERFORMANCE_HOME } }
              : resolved.views.performance
                ? { performance: { Component: PERFORMANCE, path: '/performance' as const } }
                : {}),
            ...(resolved.views.guide ? { guide: { Component: GUIDE, path: '/guide' as const } } : {}),
            ...(resolved.views.sections ? { sections: { Component: SECTIONS, path: '/sections' as const } } : {}),
            ...(resolved.approvals ? { reviews: { Component: REVIEWS, path: '/reviews' as const } } : {}),
            ...components.views,
          },
        },
      },
      collections: config.collections?.map((c) => collectionDefaults(c, resolved, previewControls)),
      globals: config.globals?.map((g) => globalDefaults(g, resolved, previewControls)),
    }
  }
