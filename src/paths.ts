/**
 * Component paths for Payload's import map. Payload resolves a package path
 * the same way it resolves its own plugins' components.
 */
const RSC = '@webheroco/payload-admin/rsc'
const CLIENT = '@webheroco/payload-admin/client'
const MULTI_SITE = '@webheroco/payload-admin/multi-site'

export const NAV_RAIL = `${RSC}#NavRail`
export const ACCOUNT_MENU = `${RSC}#AccountMenu`
export const HELP_BUTTON = `${CLIENT}#HelpButton`
export const LANGUAGE_MENU = `${CLIENT}#LanguageMenu`
export const HEADER_ROW = `${CLIENT}#HeaderRow`
export const SEO_OVERVIEW = `${RSC}#SeoOverview`
export const PERFORMANCE = `${RSC}#Performance`
export const PERFORMANCE_HOME = `${RSC}#PerformanceHome`
export const GUIDE = `${RSC}#Guide`
export const LANGUAGES_CELL = `${RSC}#LanguagesCell`
export const REVIEWS = `${RSC}#Reviews`
export const REVIEW_BUTTON = `${CLIENT}#ReviewButton`
export const REVIEW_BANNER = `${CLIENT}#ReviewBanner`

export const SWITCH_FIELD = `${CLIENT}#SwitchField`
export const SAVE_HELP = `${CLIENT}#SaveHelp`
export const PREVIEW_TOOLBAR = `${CLIENT}#PreviewToolbar`
export const DOC_STATUS = `${CLIENT}#DocStatus`
export const VERSIONS_BUTTON = `${CLIENT}#VersionsButton`
export const BLOCK_PALETTE = `${CLIENT}#BlockPalette`
export const LIST_GRID_SWITCH = `${CLIENT}#ListGridSwitch`

/** Multi-site only: needs @payloadcms/plugin-multi-tenant. */
export const SITE_MENU = `${MULTI_SITE}#SiteMenu`
