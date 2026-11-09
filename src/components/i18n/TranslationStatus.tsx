// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Translation progress in the document's status line. Editing English: a chip
 * per other language (click to switch). Editing another language: how many of
 * the page's texts are translated; untranslated ones show English on the site.
 */
import { useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React, { useEffect, useState } from 'react'

import { type LanguageProgress, progressTone, translationProgress } from './progress.js'
import { useSwitchLocale } from './useSwitchLocale.js'

export const TranslationStatus: React.FC = () => {
  const { config } = useConfig()
  const { id, collectionSlug, globalSlug, savedDocumentData } = useDocumentInfo()
  const locale = useLocale()
  const switchTo = useSwitchLocale()
  const [progress, setProgress] = useState<LanguageProgress[] | null>(null)
  const localization = config.localization || null

  useEffect(() => {
    if (!localization || (!id && !globalSlug)) return
    const path: `/${string}` = collectionSlug ? `/${collectionSlug}/${id}` : `/globals/${globalSlug}`
    const url = formatAdminURL({ apiRoute: config.routes.api, path: `${path}?locale=all&depth=0&draft=true` })
    let live = true
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((doc) => {
        if (live) setProgress(translationProgress(doc, localization.localeCodes, localization.defaultLocale))
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
    // Recount after every save.
  }, [collectionSlug, config.routes.api, globalSlug, id, localization, savedDocumentData?.updatedAt])

  if (!localization || !progress) return null
  const labelOf = (code: string) => {
    const l = localization.locales.find((x) => x.code === code)
    return typeof l?.label === 'string' ? l.label : code.toUpperCase()
  }

  if (locale.code !== localization.defaultLocale) {
    const mine = progress.find((p) => p.code === locale.code)
    if (!mine) return null
    // The language button is just an icon, so this pill names the language.
    const tone = progressTone(mine)
    return (
      <span
        className={`cms-pill cms-pill--${tone === 'done' ? 'good' : 'warn'}`}
        data-tip={
          tone === 'done'
            ? 'Every text is translated'
            : `${mine.done} of ${mine.total} texts translated. The rest show in ${labelOf(localization.defaultLocale)}.`
        }
      >
        {labelOf(mine.code)}
        {tone !== 'done' && <small>{`${mine.done}/${mine.total}`}</small>}
      </span>
    )
  }

  return (
    <span className="cms-langs" aria-label="Translations">
      {progress
        .filter((p) => p.code !== localization.defaultLocale)
        .map((p) => {
          const tone = progressTone(p)
          const note = tone === 'done' ? 'translated' : tone === 'none' ? 'not translated yet' : `${p.done} of ${p.total} texts translated`
          return (
            <button
              key={p.code}
              type="button"
              className={`cms-langs__chip is-${tone}`}
              data-tip={`${labelOf(p.code)}: ${note}. Click to edit.`}
              onClick={() => switchTo(p.code)}
            >
              {p.code.toUpperCase()}
            </button>
          )
        })}
    </span>
  )
}
