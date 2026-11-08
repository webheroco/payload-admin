/**
 * Structured data (JSON-LD) checks for the SEO overview's Schema tab.
 *
 * The site's code writes the schema, so the tab reads each live page and
 * checks what it finds against Google's rich result rules: a missing required
 * property is an error (red), a missing recommended one a warning (amber).
 * Types the site doesn't use never appear, and a type with no rules here
 * (a custom one) is listed without a verdict.
 */

export type SchemaNode = Record<string, unknown>
export type Verdict = 'good' | 'warn' | 'error' | 'none'
export type Check = { type: string; verdict: Verdict; issues: string[] }

/**
 * Types that describe the whole site rather than one page. They are shown
 * once, above the table, with how many pages carry them.
 */
export const SITE_WIDE = new Set([
  'Organization',
  'Corporation',
  'LocalBusiness',
  'ProfessionalService',
  'HomeAndConstructionBusiness',
  'GeneralContractor',
  'Electrician',
  'Plumber',
  'HVACBusiness',
  'RoofingContractor',
  'Store',
  'WebSite',
  'BreadcrumbList',
])

/** Generic page wrappers that say nothing a search engine shows. Not listed. */
const IGNORED = new Set(['WebPage', 'ItemPage', 'CollectionPage', 'AboutPage', 'ContactPage', 'SiteNavigationElement', 'ImageObject', 'Person', 'ListItem', 'Question', 'Answer', 'Offer', 'PostalAddress', 'GeoCoordinates', 'Brand', 'Rating', 'AggregateRating', 'Review', 'SearchAction', 'EntryPoint'])

const LOCAL_BUSINESS = new Set([
  'LocalBusiness',
  'ProfessionalService',
  'HomeAndConstructionBusiness',
  'GeneralContractor',
  'Electrician',
  'Plumber',
  'HVACBusiness',
  'RoofingContractor',
  'Store',
])

const has = (node: SchemaNode, key: string): boolean => {
  const v = node[key]
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

const list = (v: unknown): SchemaNode[] =>
  (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is SchemaNode => Boolean(x) && typeof x === 'object')

type Rule = { required: string[]; recommended?: string[]; extra?: (node: SchemaNode) => { errors: string[]; warnings: string[] } }

const ARTICLE: Rule = { required: ['headline'], recommended: ['image', 'datePublished', 'author'] }
const ORGANIZATION: Rule = { required: ['name'], recommended: ['url', 'logo'] }

const RULES: Record<string, Rule> = {
  Article: ARTICLE,
  BlogPosting: ARTICLE,
  NewsArticle: ARTICLE,
  Organization: ORGANIZATION,
  Corporation: ORGANIZATION,
  WebSite: { required: ['name', 'url'] },
  FAQPage: {
    required: ['mainEntity'],
    extra: (node) => {
      const errors: string[] = []
      list(node.mainEntity).forEach((q, i) => {
        if (!has(q, 'name')) errors.push(`Question ${i + 1} has no name`)
        const answer = list(q.acceptedAnswer)[0]
        if (!answer || !has(answer, 'text')) errors.push(`Question ${i + 1} has no acceptedAnswer text`)
      })
      return { errors, warnings: [] }
    },
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    extra: (node) => {
      const errors: string[] = []
      const items = list(node.itemListElement)
      items.forEach((item, i) => {
        const named = has(item, 'name') || (typeof item.item === 'object' && item.item && has(item.item as SchemaNode, 'name'))
        if (!has(item, 'position')) errors.push(`Breadcrumb ${i + 1} has no position`)
        if (!named) errors.push(`Breadcrumb ${i + 1} has no name`)
        if (i < items.length - 1 && !has(item, 'item')) errors.push(`Breadcrumb ${i + 1} has no item (address)`)
      })
      return { errors, warnings: [] }
    },
  },
  Product: {
    required: ['name'],
    recommended: ['image', 'description'],
    extra: (node) =>
      has(node, 'offers') || has(node, 'review') || has(node, 'aggregateRating')
        ? { errors: [], warnings: [] }
        : { errors: ['Needs offers, review or aggregateRating'], warnings: [] },
  },
  Recipe: { required: ['name', 'image'], recommended: ['author', 'recipeIngredient', 'recipeInstructions'] },
  Event: { required: ['name', 'startDate', 'location'], recommended: ['endDate', 'image', 'description'] },
  JobPosting: {
    required: ['title', 'description', 'datePosted', 'hiringOrganization'],
    recommended: ['validThrough', 'employmentType', 'baseSalary'],
    extra: (node) =>
      has(node, 'jobLocation') || has(node, 'jobLocationType')
        ? { errors: [], warnings: [] }
        : { errors: ['Needs jobLocation, or jobLocationType for remote jobs'], warnings: [] },
  },
  Service: { required: ['name'], recommended: ['provider', 'areaServed', 'description'] },
  VideoObject: { required: ['name', 'thumbnailUrl', 'uploadDate'], recommended: ['description', 'contentUrl'] },
  Course: { required: ['name', 'description'], recommended: ['provider'] },
  HowTo: { required: ['name', 'step'] },
}
for (const t of LOCAL_BUSINESS) RULES[t] = { required: ['name', 'address'], recommended: ['telephone', 'url', 'image'] }

/** Every typed node in the page's JSON-LD: top level, arrays and @graph. */
export function nodesOf(json: unknown): SchemaNode[] {
  const out: SchemaNode[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!v || typeof v !== 'object') return
    const node = v as SchemaNode
    if (Array.isArray(node['@graph'])) (node['@graph'] as unknown[]).forEach(walk)
    if (node['@type']) out.push(node)
  }
  walk(json)
  return out
}

export const typesOf = (node: SchemaNode): string[] =>
  (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).filter((t): t is string => typeof t === 'string')

/** Check one node against its type's rules. */
export function checkNode(node: SchemaNode): Check[] {
  return typesOf(node)
    .filter((type) => !IGNORED.has(type))
    .map((type) => {
      const rule = RULES[type]
      if (!rule) return { type, verdict: 'none' as const, issues: ['No checks for this type'] }
      const errors = rule.required.filter((k) => !has(node, k)).map((k) => `Missing ${k}`)
      const warnings = (rule.recommended ?? []).filter((k) => !has(node, k)).map((k) => `No ${k} (recommended)`)
      const extra = rule.extra?.(node)
      errors.push(...(extra?.errors ?? []))
      warnings.push(...(extra?.warnings ?? []))
      const verdict: Verdict = errors.length ? 'error' : warnings.length ? 'warn' : 'good'
      return { type, verdict, issues: [...errors, ...warnings] }
    })
}

/** Read every JSON-LD script in a page's HTML. Unreadable JSON is an error of its own. */
export function checkHtml(html: string): Check[] {
  const checks: Check[] = []
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, body] of scripts) {
    let json: unknown
    try {
      json = JSON.parse(body.trim())
    } catch {
      checks.push({ type: 'JSON-LD', verdict: 'error', issues: ['The JSON-LD could not be read (invalid JSON)'] })
      continue
    }
    for (const node of nodesOf(json)) checks.push(...checkNode(node))
  }
  return checks
}

const RANK: Record<Verdict, number> = { none: 0, good: 1, warn: 2, error: 3 }
/** The worst verdict of several. */
export const worst = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce<Verdict>((a, b) => (RANK[b] > RANK[a] ? b : a), 'none')
