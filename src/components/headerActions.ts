// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
import type { CustomComponent, SanitizedConfig } from 'payload'

/**
 * The header actions (account menu, language menu, header row) for a view
 * that renders Payload's DefaultTemplate itself. Payload only passes them to
 * the template it wraps its own views in, so without this the custom views
 * showed Payload's plain avatar link instead of the account menu. Reversed
 * the way Payload does it, so the order matches every other page.
 */
export const headerActions = (config: SanitizedConfig): CustomComponent[] => [...(config.admin?.components?.actions ?? [])].reverse()
