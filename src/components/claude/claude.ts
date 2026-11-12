// @webheroco/payload-admin. The rules behind it: client-payload references/mcp.md.
import type { SanitizedConfig } from 'payload'

/** The MCP plugin's endpoint, and the sign-in a person uses to add the site to Claude. */
export const MCP_ENDPOINT = '/mcp'
export const CONNECTOR_TOKEN_ENDPOINT = '/oauth/token'
export const CONNECTIONS_COLLECTION = 'payload-mcp-api-keys'
export const CLAUDE_PATH = '/claude'

/**
 * True when a person can add this site to Claude themselves: the MCP plugin is
 * switched on and so is the connector sign-in (client-payload's mcp-oauth).
 * Read from the built config, so it follows the site's MCP_ENABLED switch and
 * never links to a page that can't work.
 */
export function claudeReady(config: Pick<SanitizedConfig, 'endpoints'>): boolean {
  const paths = new Set((config.endpoints || []).map((e) => e.path))
  return paths.has(MCP_ENDPOINT) && paths.has(CONNECTOR_TOKEN_ENDPOINT)
}
