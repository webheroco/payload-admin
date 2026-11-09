// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { useStepNav } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useMemo } from 'react'

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

import { Icon } from '../nav/icons.js'

export type GuideSection = {
  id: string
  /** The heading it sits under. */
  group: string
  icon: string
  title: string
  steps: string[]
  action?: { label: string; href: string }
}

export const GuideClient: React.FC<{ name?: string; sections: GuideSection[] }> = ({ name, sections }) => {
  const { setStepNav } = useStepNav()
  // The title lives in the breadcrumb, not in a heading row.
  useEffect(() => setStepNav([{ label: 'How to use the admin' }]), [setStepNav])
  // Cards under their headings, each heading where its first card falls.
  const groups = useMemo(() => {
    const byGroup = new Map<string, GuideSection[]>()
    for (const s of sections) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s])
    return [...byGroup.entries()]
  }, [sections])

  return (
    <div className="cms-guide">
      <p className="cms-guide__intro">
        {name ? `Hi ${name}. ` : ''}Everything you need to keep the website up to date, one job at a time.
      </p>
      {groups.map(([group, cards]) => (
        <section key={group} className="cms-guide__group" aria-labelledby={`guide-${slug(group)}`}>
          <h2 id={`guide-${slug(group)}`} className="cms-guide__heading">
            {group}
          </h2>
          <div className="cms-guide__sections">
            {cards.map((s) => (
              <article key={s.id} id={s.id} className="cms-guide__section">
                <header>
                  <span className="cms-guide__icon">
                    <Icon name={s.icon} size={20} />
                  </span>
                  <h3>{s.title}</h3>
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
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
