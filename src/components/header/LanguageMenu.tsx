// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * Which language you are editing, top right beside the account menu. The
 * button is just the language icon, to keep the top row free for the
 * document's controls; its tip and the list name each language in its own
 * words, and a search box appears once the list is long (a site may have
 * three languages or fifty). A small dot shows you are editing a translation;
 * the document's status says which. Replaces Payload's locale picker.
 */
import { useConfig, useLocale } from '@payloadcms/ui'
import React from 'react'

import { useSwitchLocale } from '../i18n/useSwitchLocale.js'
import { Icon } from '../nav/icons.js'
import { useFilter, useMenu } from './menu.js'

const name = (label: unknown, code: string) =>
  typeof label === 'string' ? label : ((label as Record<string, string> | undefined)?.en ?? code.toUpperCase())

export const LanguageMenu: React.FC = () => {
  const { config } = useConfig()
  const locale = useLocale()
  const switchTo = useSwitchLocale()
  const menu = useMenu()
  const locales = config.localization ? config.localization.locales : []
  const defaultCode = config.localization ? config.localization.defaultLocale : undefined
  const filter = useFilter(locales, (l) => `${name(l.label, l.code)} ${l.code}`)
  if (locales.length < 2) return null
  const current = locales.find((l) => l.code === locale?.code) ?? locales[0]

  return (
    <div className="cms-menu cms-langmenu" ref={menu.ref}>
      <button
        type="button"
        className={`cms-headbutton is-icon${current.code !== defaultCode ? ' is-translating' : ''}`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Editing language: ${name(current.label, current.code)}`}
        data-tip={menu.open ? undefined : `Editing in ${name(current.label, current.code)}`}
        onClick={menu.toggle}
      >
        <Icon name="language" size={17} />
      </button>
      {menu.open && (
        <div className="cms-menu__panel is-right" role="menu" aria-label="Editing language">
          <div className="cms-menu__label">Editing language</div>
          {filter.box}
          <div className="cms-menu__list">
            {filter.shown.map((l) => {
              const active = l.code === current.code
              return (
                <button
                  key={l.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-menu-item
                  className="cms-menu__item"
                  onClick={() => {
                    menu.setOpen(false)
                    filter.reset()
                    if (!active) switchTo(l.code)
                  }}
                >
                  <span className="cms-menu__itemtext">
                    {name(l.label, l.code)}
                    {l.code === defaultCode && <small>Main language</small>}
                  </span>
                  {active && <Icon name="check" size={16} />}
                </button>
              )
            })}
            {filter.shown.length === 0 && <p className="cms-menu__note">No language matches.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
