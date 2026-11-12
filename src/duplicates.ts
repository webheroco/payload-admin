// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * The duplicate-photo check on upload collections (webheroAdmin
 * `duplicateCheck: ['media']`). Adds:
 *
 * - `contentHash`: the SHA-256 of the file, hidden and indexed. The browser
 *   fills it in when a file is picked (client uploads never pass the file
 *   through the server); a server-side upload (seed, API) gets it here.
 * - A note under the upload area (DuplicateCheck): when the picked file is
 *   already in the library it shows that picture and offers it instead;
 *   when only the name matches it says this one is saved as a separate
 *   picture. Phones reuse names like IMG_4417.jpeg for different photos, so a
 *   name alone never counts as the same picture.
 *
 * Adds a column, so the site needs a migration.
 */
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { createHash } from 'crypto'

import { DUPLICATE_CHECK } from './paths.js'

export const CONTENT_HASH = 'contentHash'

const hashUploadedFile: CollectionBeforeChangeHook = ({ data, req }) => {
  const file = req.file as { data?: Buffer } | undefined
  // Whenever the bytes pass through the server they decide the fingerprint: a
  // replaced file must not keep the old one. Browser uploads send their own.
  if (file?.data && file.data.length > 0 && data) {
    data[CONTENT_HASH] = createHash('sha256').update(file.data).digest('hex')
  }
  return data
}

export function withDuplicateCheck(collection: CollectionConfig): CollectionConfig {
  if (!collection.upload) return collection
  if (collection.fields.some((f) => 'name' in f && f.name === CONTENT_HASH)) return collection
  return {
    ...collection,
    fields: [
      {
        name: 'duplicateCheck',
        type: 'ui',
        admin: { components: { Field: DUPLICATE_CHECK } },
      },
      {
        name: CONTENT_HASH,
        type: 'text',
        index: true,
        admin: { hidden: true, disableListColumn: true, disableListFilter: true },
      },
      ...collection.fields,
    ],
    hooks: {
      ...collection.hooks,
      beforeChange: [...(collection.hooks?.beforeChange ?? []), hashUploadedFile],
    },
  }
}
