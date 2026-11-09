// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Replaces the SEO plugin's preview with one that looks like a Google
 * result: the site's icon, name and address, the title tag in blue on one
 * line, and the meta description in two. Lengths are cut the way Google
 * cuts them (by width, roughly 600px), so what doesn't fit shows as "…".
 */
import { FieldLabel, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import { publicPath, type SiteRoutes } from '../../routes.js'

type Props = {
  titlePath?: string
  descriptionPath?: string
  routes?: SiteRoutes
  homeSlug?: string
  path?: string
}

export const SerpPreview: React.FC<Props> = ({ titlePath = 'meta.title', descriptionPath = 'meta.description', routes = {}, homeSlug = 'home' }) => {
  const { collectionSlug } = useDocumentInfo()
  const title = useFormFields(([fields]) => fields[titlePath]?.value) as string | undefined
  const description = useFormFields(([fields]) => fields[descriptionPath]?.value) as string | undefined
  const slug = useFormFields(([fields]) => fields.slug?.value) as string | undefined
  const pagePath = useFormFields(([fields]) => fields.path?.value) as string | undefined
  const pageTitle = useFormFields(([fields]) => fields.title?.value) as string | undefined
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const host = origin.replace(/^https?:\/\//, '')
  const path = collectionSlug ? publicPath(routes, homeSlug, collectionSlug, { slug, path: pagePath }) : null
  const crumbs = (path ?? '/').split('/').filter(Boolean)
  const name = host.replace(/^www\./, '').split('.')[0] || 'Your site'

  return (
    <div className="field-type cms-serp-field">
      <FieldLabel label="Search result preview" />
      <div className="cms-serp" aria-label="How this page may look in Google">
        <div className="cms-serp__site">
          <span className="cms-serp__icon">
            {origin ? <img src={`${origin}/favicon.ico`} alt="" width={18} height={18} onError={(e) => (e.currentTarget.style.display = 'none')} /> : null}
          </span>
          <span className="cms-serp__where">
            <span className="cms-serp__name">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
            <span className="cms-serp__url">
              {origin || 'https://…'}
              {crumbs.map((c) => (
                <React.Fragment key={c}> › {c}</React.Fragment>
              ))}
            </span>
          </span>
        </div>
        <div className={`cms-serp__title${title ? '' : ' is-empty'}`}>{title || pageTitle || 'Add a title tag'}</div>
        <div className={`cms-serp__desc${description ? '' : ' is-empty'}`}>
          {description || 'Add a meta description. Without one, Google picks some text from the page.'}
        </div>
      </div>
      <p className="cms-serp__note">Google may choose different words, and shows a date or rating on some results.</p>
    </div>
  )
}
