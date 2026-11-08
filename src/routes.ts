/**
 * Where a document lives on the public site. Client-safe: the List/Grid
 * switch runs it in the browser, the SEO overview on the server.
 */

/** Collection slug to its public address, with `:slug` standing for the document's slug. */
export type SiteRoutes = Record<string, string>

export type PathDoc = {
  slug?: string | null
  path?: string | null
}

export const DEFAULT_ROUTES: SiteRoutes = { pages: '/:slug', posts: '/blog/:slug' }
export const DEFAULT_HOME_SLUG = 'home'

/**
 * The public path of a document, or null when it has none. A document with
 * its own `path` field (nested pages) uses that; the home page is `/`.
 */
export function publicPath(
  routes: SiteRoutes,
  homeSlug: string,
  collection: string,
  doc: PathDoc,
): string | null {
  if (typeof doc.path === 'string' && doc.path.startsWith('/')) return doc.path
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  const pattern = routes[collection]
  if (!slug || !pattern) return null
  if (slug === homeSlug && pattern === '/:slug') return '/'
  return pattern.replace(':slug', slug)
}
