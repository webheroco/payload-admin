// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * "Languages" column for localized collections: one chip per language,
 * filled when every text on the page is translated, half when some are.
 */
import type { DefaultServerCellComponentProps } from 'payload'

import React from 'react'

import { progressTone, translationProgress } from './progress.js'

export const LanguagesCell = async ({ collectionConfig, payload, rowData }: DefaultServerCellComponentProps) => {
  const localization = payload.config.localization
  if (!localization || !rowData?.id) return null
  const doc = await payload.findByID({
    collection: collectionConfig.slug as 'pages',
    id: rowData.id as number,
    depth: 0,
    draft: true,
    locale: 'all',
    overrideAccess: true,
  })
  const progress = translationProgress(doc, localization.localeCodes, localization.defaultLocale)
  return (
    <span className="cms-langs">
      {progress.map((p) => {
        const tone = progressTone(p)
        const note =
          tone === 'done' ? 'translated' : tone === 'none' ? 'not translated' : `${p.done} of ${p.total} texts translated`
        return (
          <span key={p.code} className={`cms-langs__chip is-${tone}`} data-tip={`${p.code.toUpperCase()}: ${note}`}>
            {p.code.toUpperCase()}
          </span>
        )
      })}
    </span>
  )
}
