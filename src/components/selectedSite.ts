/**
 * Multi-site: the site chosen in the site menu, from the multi-tenant
 * plugin's `payload-tenant` cookie. Server components only. Single-site
 * projects (no `tenants` collection) and lists whose collection has no
 * `tenant` field get no filter.
 */
import type { Payload, Where } from 'payload'

import { cookies } from 'next/headers'

/** The chosen site's id, or undefined on a one-site CMS or before one is chosen. */
export async function selectedSiteID(payload: Payload): Promise<string | undefined> {
  if (!payload.collections['tenants' as 'users']) return undefined
  return (await cookies()).get('payload-tenant')?.value || undefined
}

/** A `where` that keeps a collection's rows to the chosen site, when it has a site. */
export function siteWhere(payload: Payload, collection: string, siteID: string | undefined): Where | undefined {
  if (!siteID) return undefined
  const fields = payload.collections[collection as 'users']?.config.flattenedFields ?? []
  if (!fields.some((f) => f.name === 'tenant')) return undefined
  return { tenant: { equals: siteID } }
}
