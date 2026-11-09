/**
 * @webheroco/payload-admin: the WebHero Payload admin, shared by every client
 * site. This entry is for payload.config.ts and has no React in it.
 */
export { webheroAdmin } from './plugin.js'
export type { ApprovalOptions, EnquirySource, GuideCard, RailLink, ResolvedOptions, WebheroAdminOptions } from './options.js'
export { canApprove } from './options.js'
export { REVIEWS_SLUG } from './approvals.js'
export { withPlainSeoTab, withShallowRelations, withSwitches } from './defaults.js'
export { DEFAULT_HOME_SLUG, DEFAULT_ROUTES, publicPath, type PathDoc, type SiteRoutes } from './routes.js'
export * from './paths.js'
