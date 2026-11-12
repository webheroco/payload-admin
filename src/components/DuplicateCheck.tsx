// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'
/**
 * Under the upload area of a collection with `duplicateCheck` (duplicates.ts).
 * When a file is picked it works out the file's fingerprint (SHA-256), saves
 * it on the document, and looks for the same picture already in the library:
 *
 * - The same file (same fingerprint): shows that picture with "Use that one"
 *   (in a pop-up from a field: picks it and closes) or "Open it".
 * - For pictures uploaded before the check existed (no fingerprint), the same
 *   size in bytes and, for images, the same width and height: shown as "looks like", with its thumbnail, so the editor
 *   judges by eye.
 * - Only the same name: says this one is saved as a separate picture.
 */
import { useConfig, useDocumentDrawerContext, useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Match = { id: string | number; filename?: string; alt?: string; thumbnailURL?: string; url?: string }
type Found = { same?: Match; likely?: boolean; sameName?: Match }

/** Width and height of a picked image, or null for files the browser can't draw. */
async function dimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

async function fingerprint(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const DuplicateCheck: React.FC = () => {
  const { config, getEntityConfig } = useConfig()
  const { collectionSlug, id } = useDocumentInfo()
  const drawer = useDocumentDrawerContext() as { onSave?: (args: Record<string, unknown>) => void }
  const file = useFormFields(([fields]) => fields.file?.value) as unknown
  const { setValue: setHash } = useField<string>({ path: 'contentHash' })
  const [found, setFound] = useState<Found>({})
  const [using, setUsing] = useState(false)

  const api = `${config.serverURL ?? ''}${config.routes.api}/${collectionSlug}`
  const label = (getEntityConfig({ collectionSlug }) as { labels?: { plural?: unknown } } | undefined)?.labels?.plural
  const library = typeof label === 'string' ? label : 'the library'

  useEffect(() => {
    if (typeof File === 'undefined' || !(file instanceof File)) {
      setFound({})
      return
    }
    let stale = false
    // A new file: the last file's match must not stay on screen (or be chosen) while this one is checked.
    setFound({})
    setUsing(false)
    ;(async () => {
      const [hash, size] = await Promise.all([fingerprint(file), dimensions(file)])
      if (stale) return
      setHash(hash)
      const query = (where: Record<string, string>) => {
        const params = new URLSearchParams({ depth: '0', limit: '1' })
        for (const [k, v] of Object.entries(where)) params.set(k, v)
        if (id !== undefined && id !== null) params.set('where[and][9][id][not_equals]', String(id))
        return fetch(`${api}?${params}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((r: { docs?: Match[] } | null) => r?.docs?.[0])
          .catch(() => undefined)
      }
      const [exact, bySize, sameName] = await Promise.all([
        query({ 'where[and][0][contentHash][equals]': hash }),
        query({
          'where[and][0][filesize][equals]': String(file.size),
          'where[and][1][contentHash][exists]': 'false',
          ...(size
            ? { 'where[and][2][width][equals]': String(size.width), 'where[and][3][height][equals]': String(size.height) }
            : {}),
        }),
        query({ 'where[and][0][filename][equals]': file.name }),
      ])
      const same = exact ?? bySize
      if (!stale) setFound({ same, likely: !exact && Boolean(bySize), sameName: same ? undefined : sameName })
    })()
    return () => {
      stale = true
    }
  }, [file, api, id, setHash])

  const useExisting = async () => {
    if (!found.same || !drawer.onSave) return
    setUsing(true)
    const doc = await fetch(`${api}/${found.same.id}?depth=0`, { credentials: 'include' }).then((r) => r.json())
    drawer.onSave({ doc, operation: 'create', result: doc })
  }

  if (found.same) {
    const m = found.same
    const href = `${config.routes.admin}/collections/${collectionSlug}/${m.id}`
    return (
      <div className="cms-duplicate" role="status">
        {(m.thumbnailURL || m.url) && <img src={m.thumbnailURL || m.url} alt="" width={64} height={64} />}
        <div>
          <strong>{found.likely ? `This looks like a picture already in ${library}` : `This picture is already in ${library}`}</strong>
          <span>
            Saved as {m.filename}
            {m.alt ? `: “${m.alt}”` : ''}. Use that one so it stays in one place, or carry on to save this as a new picture.
          </span>
          <div className="cms-duplicate__actions">
            {drawer.onSave ? (
              <button type="button" className="cms-duplicate__use" onClick={useExisting} disabled={using}>
                {using ? 'Choosing…' : 'Use that one'}
              </button>
            ) : (
              <Link href={href} prefetch={false} className="cms-duplicate__use">
                Open it
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }
  if (found.sameName) {
    return (
      <div className="cms-duplicate is-note" role="status">
        <div>
          <strong>Another picture is already called {found.sameName.filename}</strong>
          <span>This is a different picture, so it is saved as a new one with its own name. Nothing already on the website changes.</span>
        </div>
      </div>
    )
  }
  return null
}
