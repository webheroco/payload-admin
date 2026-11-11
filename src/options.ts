/**
 * The project's settings for the admin, as given to `webheroAdmin()` and
 * kept on `admin.custom.webheroAdmin` so the server components can read them.
 */
import type { CustomComponent, SanitizedConfig } from 'payload'

import { DEFAULT_HOME_SLUG, DEFAULT_ROUTES, type SiteRoutes } from './routes.js'

/** Where the Performance page counts enquiries from. */
export type EnquirySource =
  /** The skill's standard: one Submissions collection with a form type field. */
  | { collection: string; formField: string; pageField?: string }
  /** The official Form Builder plugin: `forms` and `form-submissions`. */
  | { formBuilder: true }

/** A link out of the admin, shown in the menu after the groups and opened in a new tab. */
export type RailLink = {
  label: string
  /** An absolute address, such as the shop's own admin. */
  href: string
  /** An icon name from the package's set (nav/icons.tsx). Default `external`. */
  icon?: string
  /** The hover tip. Default: the label. */
  tip?: string
  /** Links with the same group sit together, as one block of the menu. Default `Links`. */
  group?: string
}

/** One more card in "How to use the admin", in the editor's words. */
export type GuideCard = {
  id: string
  title: string
  steps: string[]
  /** An icon name from the package's set. Default `file`. */
  icon?: string
  /** A button to the screen the card is about: an admin path (`/collections/pages`) or an absolute address. */
  action?: { label: string; href: string }
  /** Only shown to people who can read this collection. */
  collection?: string
  /** Placed after the card with this id. Default: before "Your account". */
  after?: string
  /** The heading it sits under, such as "Shop". Default: the heading of the card it follows. */
  group?: string
}

export type WebheroAdminOptions = {
  /**
   * Where each routable collection lives on the site, `:slug` standing for
   * the slug. Used for the List/Grid page tiles and the SEO overview's links.
   * Default `{ pages: '/:slug', posts: '/blog/:slug' }`.
   */
  routes?: SiteRoutes
  /** The slug of the page served at `/`. Default `home`. */
  homeSlug?: string
  /**
   * The collections listed in the SEO overview, with what one row is called.
   * Default: Pages and Posts, where they exist.
   */
  seo?: { slug: string; kind: string }[]
  /**
   * Where Performance counts enquiries. Default: the Form Builder when the
   * config has `form-submissions`, else a `submissions` collection whose
   * `form` field names the form.
   */
  enquiries?: EnquirySource
  /** Collections and globals with Live Preview: they get the preview toolbar. */
  livePreview?: { collections?: string[]; globals?: string[] }
  /**
   * Components added beside the preview toolbar wherever Live Preview is on,
   * such as the site's own click-to-edit bridge.
   */
  previewControls?: CustomComponent[]
  /** Collections with translations: they get a Languages column. */
  translated?: string[]
  /**
   * One line at the top of each edit view saying how saving works there, by
   * collection or global slug. Leave a slug out to show nothing.
   */
  saveHelp?: Record<string, string>
  /** Rows per list page. Default 25. */
  listPageSize?: number
  /**
   * Links out of the admin at the foot of the menu, opened in a new tab, such
   * as the shop's own admin when products and orders live somewhere else.
   */
  links?: RailLink[]
  /**
   * A "View website" link in the menu: the site chosen in the site menu on
   * multi-site (its tenant's `origin`), else `serverURL`. Default off.
   */
  websiteLink?: boolean
  /** More cards for "How to use the admin", for what this site has that others don't. */
  guideCards?: GuideCard[]
  /** Versions kept per document. Default 50. */
  maxVersions?: number
  /**
   * When the site replaced another domain, that domain (e.g. 'old-site.com'):
   * the SEO overview's Redirects show each old address in full. On multi-site,
   * one per site, keyed by the tenant id: { '1': 'old-site.com' }.
   */
  redirectsFrom?: string | Record<string, string>
  /** Log any read or save slower than this many milliseconds ("cms-timing ..."). Default 1000; false turns it off. */
  slowLog?: number | false
  /** Turn a page off with `false`. All on by default. */
  views?: { seo?: boolean; performance?: boolean; guide?: boolean; sections?: boolean }
  /**
   * What opens when someone signs in. Default 'performance': the admin's home
   * is the Performance page and there is no separate dashboard of links that
   * repeat the menu. 'dashboard' keeps Payload's dashboard (and the site's
   * beforeDashboard) with Performance at /performance.
   */
  home?: 'performance' | 'dashboard'
  /**
   * Sign-off before anything goes live. Off unless set. `true` uses the
   * defaults: approvers are users whose `role` is super-admin or client-admin,
   * and every collection and global with drafts goes through review.
   */
  approvals?: boolean | ApprovalOptions
}

export type ApprovalOptions = {
  /** Role values that may approve: publish, schedule and request changes. Default super-admin, client-admin. */
  approverRoles?: string[]
  /** The users field holding the role (a select, single or many). Default `role`. */
  roleField?: string
  /** Only these collection and global slugs. Default: everything with drafts. */
  only?: string[]
}

export type ResolvedApprovals = { approverRoles: string[]; roleField: string; only: string[] | null }

/** True when the user holds one of the approver roles. */
export const canApprove = (user: unknown, a: ResolvedApprovals) => {
  const value = (user as Record<string, unknown> | null)?.[a.roleField]
  return (Array.isArray(value) ? value : [value]).some((v) => typeof v === 'string' && a.approverRoles.includes(v))
}

/** The options with every default filled in. Plain data only, so it can sit on the config. */
export type ResolvedOptions = {
  routes: SiteRoutes
  homeSlug: string
  seo: { slug: string; kind: string }[]
  enquiries: EnquirySource
  livePreview: { collections: string[]; globals: string[] }
  translated: string[]
  saveHelp: Record<string, string>
  listPageSize: number
  links: RailLink[]
  websiteLink: boolean
  guideCards: GuideCard[]
  maxVersions: number
  redirectsFrom: string | Record<string, string> | null
  slowLog: number | false
  views: { seo: boolean; performance: boolean; guide: boolean; sections: boolean }
  home: 'performance' | 'dashboard'
  approvals: ResolvedApprovals | null
}

export function resolveOptions(options: WebheroAdminOptions, collectionSlugs: Set<string>): ResolvedOptions {
  const defaultSeo = [
    { slug: 'pages', kind: 'Page' },
    { slug: 'posts', kind: 'Post' },
  ].filter((k) => collectionSlugs.has(k.slug))
  const enquiries: EnquirySource =
    options.enquiries ??
    (collectionSlugs.has('form-submissions')
      ? { formBuilder: true }
      : { collection: 'submissions', formField: 'form', pageField: 'page' })
  return {
    routes: options.routes ?? DEFAULT_ROUTES,
    homeSlug: options.homeSlug ?? DEFAULT_HOME_SLUG,
    seo: options.seo ?? defaultSeo,
    enquiries,
    livePreview: {
      collections: options.livePreview?.collections ?? [],
      globals: options.livePreview?.globals ?? [],
    },
    translated: options.translated ?? [],
    saveHelp: options.saveHelp ?? {},
    listPageSize: options.listPageSize ?? 25,
    links: options.links ?? [],
    websiteLink: options.websiteLink ?? false,
    guideCards: options.guideCards ?? [],
    maxVersions: options.maxVersions ?? 50,
    redirectsFrom: options.redirectsFrom ?? null,
    slowLog: options.slowLog ?? 1000,
    views: {
      seo: options.views?.seo ?? true,
      performance: options.views?.performance ?? true,
      guide: options.views?.guide ?? true,
      sections: options.views?.sections ?? true,
    },
    // Performance can only be home when it is switched on.
    home: (options.views?.performance ?? true) ? (options.home ?? 'performance') : 'dashboard',
    approvals: options.approvals
      ? {
          approverRoles: (options.approvals === true ? undefined : options.approvals.approverRoles) ?? ['super-admin', 'client-admin'],
          roleField: (options.approvals === true ? undefined : options.approvals.roleField) ?? 'role',
          only: (options.approvals === true ? undefined : options.approvals.only) ?? null,
        }
      : null,
  }
}

/** The settings on a built config, or the defaults when the plugin isn't installed. */
export function readOptions(config: Pick<SanitizedConfig, 'admin' | 'collections'>): ResolvedOptions {
  const stored = (config.admin?.custom as { webheroAdmin?: ResolvedOptions } | undefined)?.webheroAdmin
  return stored ?? resolveOptions({}, new Set(config.collections.map((c) => c.slug)))
}
