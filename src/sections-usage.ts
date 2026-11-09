// @webheroco/payload-admin. Which sections each page uses, read cheaply.
/**
 * The Sections page needs, for each page, only the kinds of section it holds.
 * Asking Payload for that still joins every section table into one query: on
 * a site with a few hundred kinds of section that one query took half a
 * minute. On Postgres each kind of section is its own table, so one
 * `union all` over them answers it in a single quick round trip.
 *
 * Returns null where this shortcut doesn't apply (another database, or the
 * adapter's tables aren't where we expect); the caller then asks Payload.
 * Server only; no React or Next.
 */

type Pool = { query: (text: string) => Promise<{ rows: Record<string, unknown>[] }> }
type Relation = { type?: string; to?: string }
type DrizzleAdapter = {
  pool?: Pool
  rawRelations?: Record<string, Record<string, Relation>>
  tableNameMap?: Map<string, string>
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`

/**
 * The block tables of a collection's (or its versions') table, by block slug,
 * as Payload's Postgres adapter recorded them: relation `_blocks_<slug>` →
 * the table it points at.
 */
export function blockTables(relations: Record<string, Relation> | undefined, slugs: string[]): Map<string, string> {
  const out = new Map<string, string>()
  if (!relations) return out
  for (const slug of slugs) {
    const to = relations[`_blocks_${slug}`]?.to
    if (typeof to === 'string' && to) out.set(slug, to)
  }
  return out
}

/** The SQL: each block table's rows as (slug, owner id), the owner being the document (or its latest version's document). */
export function usageSql(tables: Map<string, string>, versionsTable?: string): string | null {
  if (!tables.size) return null
  const parts = [...tables].map(([slug, table]) => `select ${literal(slug)} as slug, _parent_id from ${quote(table)}`)
  const union = parts.join('\nunion all\n')
  if (!versionsTable) return `select distinct b.slug, b._parent_id as id from (${union}) b`
  return `select distinct b.slug, v.parent_id as id from (${union}) b join ${quote(versionsTable)} v on v.id = b._parent_id where v.latest = true`
}

/**
 * Document id → the section slugs it uses, for `collectionSlug`, or null
 * when the shortcut doesn't apply. `drafts`: read the latest version (what
 * the editor sees), as the list does.
 */
export async function sectionUsage(
  db: unknown,
  collectionSlug: string,
  slugs: string[],
  drafts: boolean,
): Promise<Map<string, Set<string>> | null> {
  const adapter = db as DrizzleAdapter
  if (typeof adapter?.pool?.query !== 'function' || !adapter.rawRelations || !(adapter.tableNameMap instanceof Map)) return null
  const table = adapter.tableNameMap.get(collectionSlug.replace(/-/g, '_')) ?? collectionSlug.replace(/-/g, '_')
  const versionsTable = drafts ? adapter.tableNameMap.get(`_${table}_v`) ?? `_${table}_v` : undefined
  const relations = adapter.rawRelations[versionsTable ?? table]
  const tables = blockTables(relations, slugs)
  // Every kind must be found, or the answer would quietly miss some.
  if (tables.size !== new Set(slugs).size) return null
  const text = usageSql(tables, versionsTable)
  if (!text) return new Map()
  const { rows } = await adapter.pool.query(text)
  const out = new Map<string, Set<string>>()
  for (const row of rows) {
    const id = String(row.id)
    if (!out.has(id)) out.set(id, new Set())
    out.get(id)!.add(String(row.slug))
  }
  return out
}
