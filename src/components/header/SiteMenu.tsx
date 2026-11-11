// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Which site you are working on, as a workspace switcher at the top of the
 * menu. Sites work like workspaces, and there may be two or twenty, so it is
 * a dropdown: the current site's logo and name, and a list of each site with
 * its domain, and a search box once the list is long. There is always one
 * site chosen, never "all", and on a one-site CMS it renders nothing. It
 * drives the multi-tenant plugin's own selection, so lists, new documents and
 * Performance follows it.
 *
 * Register it with TenantDefault in admin.components.beforeNavLinks; the
 * NavRail menu renders that slot at the top of the menu in place of the logo.
 * TenantDefault picks the site whose domain the admin was opened on; this
 * falls back to the first site if nothing is chosen.
 *
 * clientProps (optional):
 * - wordmarks: { 'example.co.uk': '/logos/example.svg' }, keyed by domain
 *   without www. A site with a wordmark shows that image in the button and
 *   the list instead of the small mark, name and domain (the name stays in
 *   the tip and for screen readers). For brands whose logo is a wordmark.
 * - mark: a square image for the collapsed rail when wordmarks are used.
 */
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'
import { useConfig } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect } from 'react'

import { Mark, useFilter, useMenu, useSites } from './menu.js'
import { Icon } from '../nav/icons.js'

type Choice = { id: string; value: number | string; name: string; domain?: string | null; logo?: string | null; wordmark?: string }

type Props = { wordmarks?: Record<string, string>; mark?: string }

const bare = (domain?: string | null) =>
  (domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

export const SiteMenu: React.FC<Props> = ({ wordmarks, mark }) => {
  const { options, selectedTenantID, setTenant, entityType } = useTenantSelection()
  const { config } = useConfig()
  const sites = useSites()
  const menu = useMenu()

  const choices: Choice[] = (options ?? []).map((o) => {
    const site = sites.find((s) => String(s.id) === String(o.value))
    return {
      id: String(o.value),
      // The plugin matches the site by its own id, number or string, with ===.
      value: o.value as number | string,
      name: typeof o.label === 'string' ? o.label : String(o.value),
      domain: site?.domain,
      logo: site?.logo,
      wordmark: wordmarks?.[bare(site?.domain)],
    }
  })
  const filter = useFilter(choices, (c) => `${c.name} ${c.domain ?? ''}`)
  const current = choices.find((c) => c.id === String(selectedTenantID))

  // Always one site: with nothing chosen yet, start on the first.
  const first = choices[0]?.value
  useEffect(() => {
    if (choices.length > 1 && !current && first !== undefined && entityType !== 'document') setTenant({ id: first, refresh: true })
  }, [choices.length, current, first, entityType, setTenant])

  if (choices.length < 2 || !current) return null

  // Inside a document the site is the document's own; switching happens from lists.
  const locked = entityType === 'document'
  const pick = (choice: Choice) => {
    menu.setOpen(false)
    filter.reset()
    if (choice.id !== current.id) setTenant({ id: choice.value, refresh: true })
  }

  return (
    <div className="cms-menu cms-sitemenu" ref={menu.ref}>
      <button
        type="button"
        className="cms-sitemenu__button"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.toggle}
        data-tip={current.name}
      >
        {current.wordmark ? (
          <>
            <span className="cms-sitemenu__mark">
              <Mark label={current.name} src={mark ?? current.logo} size={30} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cms-sitemenu__wordmark" src={current.wordmark} alt={current.name} />
          </>
        ) : (
          <>
            <Mark label={current.name} src={current.logo} size={30} />
            <span className="cms-sitemenu__text">
              <strong>{current.name}</strong>
              {current.domain && <small>{current.domain}</small>}
            </span>
          </>
        )}
        <Icon name="chevrons" size={16} />
      </button>

      {menu.open && (
        <div className="cms-menu__panel cms-sitemenu__panel" role="menu" aria-label="Site">
          <div className="cms-menu__label">Site</div>
          {locked && <p className="cms-menu__note">Leave this page to switch site. It belongs to {current.name}.</p>}
          {filter.box}
          <div className="cms-menu__list">
            {filter.shown.map((c) => {
              const active = c.id === current.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-menu-item
                  disabled={locked && !active}
                  className="cms-menu__item"
                  onClick={() => pick(c)}
                >
                  {c.wordmark ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="cms-sitemenu__wordmark" src={c.wordmark} alt={c.name} />
                  ) : (
                    <>
                      <Mark label={c.name} src={c.logo} size={26} />
                      <span className="cms-menu__itemtext">
                        {c.name}
                        {c.domain && <small>{c.domain}</small>}
                      </span>
                    </>
                  )}
                  {active && <Icon name="check" size={16} />}
                </button>
              )
            })}
            {filter.shown.length === 0 && <p className="cms-menu__note">No site matches.</p>}
          </div>
          <div className="cms-menu__foot">
            <Link
              href={`${config.routes.admin}/collections/tenants`} // adapt if the sites collection has another slug
              prefetch={false}
              className="cms-menu__item"
              data-menu-item
              onClick={() => menu.setOpen(false)}
            >
              <Icon name="settings" size={16} />
              <span className="cms-menu__itemtext">Manage sites</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
