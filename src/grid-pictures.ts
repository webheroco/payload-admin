// @webheroco/payload-admin. List/Grid tile pictures, with no React, so the
// tests can run it in plain Node.

export type PictureDoc = { id: number | string; [key: string]: unknown }
type Ref = PictureDoc | number | string | null | undefined

/**
 * The first picture found along any of `paths` ("gallery.image" looks in
 * every gallery row for an image; "meta.image" in the SEO group).
 */
export function pictureOf(doc: Record<string, unknown>, paths: string[]): Ref {
  const walk = (value: unknown, keys: string[]): Ref => {
    if (value == null) return null
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, keys)
        if (found != null) return found
      }
      return null
    }
    if (!keys.length) return value as Ref
    return typeof value === 'object' ? walk((value as Record<string, unknown>)[keys[0]], keys.slice(1)) : null
  }
  for (const path of paths) {
    const found = walk(doc, path.split('.'))
    if (found != null && found !== '') return found
  }
  return null
}

/**
 * The request that reads the picture fields for the documents on show. The
 * list's own query may hold only the visible columns, so the fields are
 * asked for here, with their images (depth 1), from the latest draft, as the
 * list shows it.
 */
export function pictureQuery(collectionSlug: string, ids: string[], paths: string[]): string {
  const params = new URLSearchParams({
    'where[id][in]': ids.join(','),
    depth: '1',
    draft: 'true',
    limit: String(ids.length),
    pagination: 'false',
  })
  for (const top of new Set(paths.map((path) => path.split('.')[0]))) params.set(`select[${top}]`, 'true')
  return `${collectionSlug}?${params}`
}

/** Each document's picture, by id, from that request's documents. */
export function picturesFrom(docs: Array<Record<string, unknown>>, paths: string[]): Record<string, PictureDoc> {
  const found: Record<string, PictureDoc> = {}
  for (const doc of docs) {
    const ref = pictureOf(doc, paths)
    if (ref && typeof ref === 'object') found[String(doc.id)] = ref
  }
  return found
}
