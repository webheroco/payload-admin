// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * How much of a document is translated. Reads a document fetched with
 * `locale: 'all'`, where every localized field comes back as
 * { en: ..., fr: ..., es: ... }, and counts the fields that have words in the
 * default language and in each other language. No field lists to maintain.
 */
export type LanguageProgress = { code: string; done: number; total: number }

const hasWords = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some(hasWords)
  if (typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (node.type === 'text' && typeof node.text === 'string') return node.text.trim().length > 0
    return Object.values(node).some(hasWords)
  }
  return false
}

export const translationProgress = (
  doc: unknown,
  codes: string[],
  defaultCode: string,
): LanguageProgress[] => {
  const counts = new Map(codes.map((code) => [code, { code, done: 0, total: 0 }]))
  const isLeaf = (v: Record<string, unknown>) => {
    const keys = Object.keys(v)
    return keys.length > 0 && keys.every((k) => codes.includes(k))
  }
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    const obj = value as Record<string, unknown>
    if (isLeaf(obj)) {
      if (!hasWords(obj[defaultCode])) return
      for (const entry of counts.values()) {
        entry.total++
        if (hasWords(obj[entry.code])) entry.done++
      }
      return
    }
    Object.values(obj).forEach(walk)
  }
  walk(doc)
  return codes.map((code) => counts.get(code)!)
}

export const progressTone = ({ done, total }: LanguageProgress) =>
  total === 0 || done === total ? 'done' : done === 0 ? 'none' : 'part'
