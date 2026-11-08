// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Versions as an icon button in the document's one control row (the Edit,
 * Versions and API tabs row is hidden). The count sits in the hover tip.
 */
import { useConfig, useDocumentInfo } from '@payloadcms/ui'
import Link from 'next/link'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

export const VersionsButton: React.FC = () => {
  const { config } = useConfig()
  const { id, collectionSlug, globalSlug, versionCount } = useDocumentInfo()
  if (!id && !globalSlug) return null
  const path: `/${string}` = collectionSlug ? `/collections/${collectionSlug}/${id}/versions` : `/globals/${globalSlug}/versions`
  const tip = versionCount ? `Versions (${versionCount})` : 'Versions'
  return (
    <Link
      href={formatAdminURL({ adminRoute: config.routes.admin, path })}
      className="cms-icon-button"
      aria-label={tip}
      data-tip={tip}
      prefetch={false}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </svg>
    </Link>
  )
}
