// @webheroco/payload-admin. The rules behind it: client-payload references/mcp.md.
/**
 * "Use Claude with your website" (/claude): how an editor adds this site to
 * Claude as a connector, in their words, with the site's own address to copy.
 * Linked from the guide and the account menu, and only while the site's MCP
 * and connector sign-in are switched on (claude.ts).
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { notFound } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'
import { headerActions } from '../headerActions.js'
import { claudeReady, CONNECTIONS_COLLECTION } from './claude.js'
import { ClaudeSetupClient } from './ClaudeSetupClient.js'

/** The address this admin was opened on, so each domain of a multi-site admin shows its own. */
function siteOrigin(headers: Headers, serverURL: string | undefined): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) return serverURL ?? ''
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto.split(',')[0]}://${host.split(',')[0]}`
}

export const ClaudeSetup = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  if (!user) throw new Error('Your account could not be read just now. Reload the page in a moment.')
  if (!claudeReady(payload.config)) notFound()

  const { claude } = readOptions(payload.config)
  const adminRoute = payload.config.routes.admin
  const apiRoute = payload.config.routes.api
  const address = `${siteOrigin(req.headers, payload.config.serverURL)}${apiRoute}/mcp`
  const connections = permissions?.collections?.[CONNECTIONS_COLLECTION]?.read
    ? formatAdminURL({ adminRoute, path: `/collections/${CONNECTIONS_COLLECTION}` })
    : undefined

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
      viewActions={headerActions(payload.config)}
    >
      <Gutter>
        <ClaudeSetupClient address={address} connections={connections} termsUrl={claude.termsUrl ?? undefined} />
      </Gutter>
    </DefaultTemplate>
  )
}
