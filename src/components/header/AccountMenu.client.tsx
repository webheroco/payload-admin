// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

/**
 * The account menu, top right, in place of Payload's avatar link. The picture
 * is, in order: the photo the person uploaded on their account, the logo of
 * the site whose domain matches their email, their company's icon from their
 * email domain (not for Gmail, Outlook and the like), then their initials.
 * Clicking it opens their name, the theme (Light, Dark, System), Settings
 * (Admin users, Sites and anything else in the Settings group that this
 * person may open), their account and Log out, so none of that takes room in
 * the menu.
 */
import { useAuth, useConfig, useTheme } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { Icon } from '../nav/icons.js'
import { Mark, useApiURL, useMenu, useSites } from './menu.js'

const PERSONAL_EMAIL = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|aol|proton|protonmail|gmx|btinternet|sky|virginmedia|talktalk)\./

const useAvatar = (user: any) => {
  const sites = useSites()
  const api = useApiURL()
  const [photo, setPhoto] = useState<string | null>(null)
  useEffect(() => {
    if (!user?.id) return
    const p = user.photo
    if (p && typeof p === 'object') return setPhoto(p.sizes?.thumbnail?.url ?? p.url ?? null)
    if (!p) return setPhoto(null)
    // `me` returns the photo as an id; fetch the image once.
    fetch(`${api}/media/${p}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setPhoto(m?.sizes?.thumbnail?.url ?? m?.url ?? null))
      .catch(() => setPhoto(null))
  }, [api, user?.id, user?.photo])

  if (photo) return photo
  const domain = String(user?.email ?? '').split('@')[1]?.toLowerCase()
  if (!domain) return null
  const site = sites.find((s) => s.domain && s.logo && domain.endsWith(s.domain.replace(/^www\./, '')))
  if (site) return site.logo
  if (PERSONAL_EMAIL.test(domain) || domain === 'example.com') return null
  return `https://${domain}/apple-touch-icon.png`
}

export type SettingsLink = { slug: string; label: string; href: string; icon: string }

export const AccountMenuClient: React.FC<{ settings: SettingsLink[]; claude?: string }> = ({ settings, claude }) => {
  const { user } = useAuth<any>()
  const { config } = useConfig()
  const { autoMode, setTheme, theme } = useTheme()
  const menu = useMenu()
  const avatar = useAvatar(user)
  if (!user) return null

  const adminRoute = config.routes.admin
  const who = user.name || user.email
  const themeChoice = autoMode ? 'auto' : theme
  const themeLocked = Boolean(config.admin?.theme && config.admin.theme !== 'all')
  const themes = [
    { value: 'light', icon: 'sun', label: 'Light' },
    { value: 'dark', icon: 'moon', label: 'Dark' },
    { value: 'auto', icon: 'system', label: 'System' },
  ] as const

  return (
    <div className="cms-menu cms-accountmenu" ref={menu.ref}>
      <button
        type="button"
        className="cms-accountmenu__button"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Account: ${who}`}
        onClick={menu.toggle}
      >
        <Mark label={who} src={avatar} size={32} round />
      </button>
      {menu.open && (
        <div className="cms-menu__panel is-right cms-accountmenu__panel" role="menu" aria-label="Account">
          <div className="cms-accountmenu__who">
            <Mark label={who} src={avatar} size={40} round />
            <span>
              <strong>{user.name || 'Your account'}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          {/* Only when the site lets people choose (admin.theme 'all', Payload's default). */}
          {themeLocked ? null : (
          <>
          <div className="cms-menu__label">Theme</div>
          <div className="cms-accountmenu__themes" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={themeChoice === t.value}
                data-menu-item
                className={`cms-accountmenu__theme${themeChoice === t.value ? ' is-active' : ''}`}
                onClick={() => setTheme(t.value as 'light' | 'dark')}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>
          </>
          )}
          {settings.length > 0 && (
            <>
              <div className="cms-menu__label cms-menu__label--rule">Settings</div>
              {settings.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  prefetch={false}
                  className="cms-menu__item"
                  data-menu-item
                  onClick={() => menu.setOpen(false)}
                >
                  <Icon name={s.icon} size={16} />
                  <span className="cms-menu__itemtext">{s.label}</span>
                </Link>
              ))}
            </>
          )}
          <div className="cms-menu__foot">
            {claude && (
              <Link href={claude} prefetch={false} className="cms-menu__item" data-menu-item onClick={() => menu.setOpen(false)}>
                <Icon name="chat" size={16} />
                <span className="cms-menu__itemtext">Use with Claude</span>
              </Link>
            )}
            <Link
              href={`${adminRoute}/account`}
              prefetch={false}
              className="cms-menu__item"
              data-menu-item
              onClick={() => menu.setOpen(false)}
            >
              <Icon name="account" size={16} />
              <span className="cms-menu__itemtext">Profile</span>
            </Link>
            <Link
              href={`${adminRoute}/logout`}
              prefetch={false}
              className="cms-menu__item"
              data-menu-item
              onClick={() => menu.setOpen(false)}
            >
              <Icon name="logout" size={16} />
              <span className="cms-menu__itemtext">Log out</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
