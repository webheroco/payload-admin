// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect } from 'react'

import { Icon } from '../nav/icons.js'

export type GuideSection = {
  id: string
  icon: string
  title: string
  steps: string[]
  action?: { label: string; href: string }
}

export const GuideClient: React.FC<{ name?: string; sections: GuideSection[] }> = ({ name, sections }) => {
  const { setStepNav } = useStepNav()
  // The title lives in the breadcrumb, not in a heading row.
  useEffect(() => setStepNav([{ label: 'How to use the admin' }]), [setStepNav])

  return (
    <div className="cms-guide">
      <p className="cms-guide__intro">
        {name ? `Hi ${name}. ` : ''}Everything you need to keep the website up to date, one job at a time.
      </p>
      <nav className="cms-guide__contents" aria-label="Contents">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            <Icon name={s.icon} size={16} />
            {s.title}
          </a>
        ))}
      </nav>
      <div className="cms-guide__sections">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="cms-guide__section">
            <header>
              <span className="cms-guide__icon">
                <Icon name={s.icon} size={20} />
              </span>
              <h2>{s.title}</h2>
            </header>
            <ol>
              {s.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {s.action && (
              <Link href={s.action.href} prefetch={false} className="cms-guide__action">
                {s.action.label}
                <Icon name="expand" size={14} />
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
