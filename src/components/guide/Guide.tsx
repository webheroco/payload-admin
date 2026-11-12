// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
/**
 * How to use the admin (admin.components.views.guide, path /guide), opened
 * from the last item in the menu. Short, task-by-task, in the editor's words, with a
 * button to the screen each step is about. Sections for sites and languages
 * only appear when the CMS has more than one.
 */
import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

import { readOptions } from '../../options.js'

import { GuideClient, type GuideSection } from './GuideClient.js'
import { headerActions } from '../headerActions.js'
import { claudeReady } from '../claude/claude.js'

export const Guide = async ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { payload, user } = req
  const adminRoute = payload.config.routes.admin
  // Payload signs people out before a view runs, so no user here means the
  // account couldn't be read (the database is busy or restarting). Show
  // Payload's error rather than bouncing through the login page to home.
  if (!user) throw new Error('Your account could not be read just now. Reload the page in a moment.')

  const url = (path: `/${string}`) => formatAdminURL({ adminRoute, path })
  const { home, guideCards, views } = readOptions(payload.config)
  const can = (slug: string) => Boolean(permissions?.collections?.[slug]?.read)
  const locales = payload.config.localization ? payload.config.localization.locales : []
  const sites = can('tenants') ? (await payload.count({ collection: 'tenants', req })).totalDocs : 0

  const standard: GuideSection[] = [
    {
      id: 'around',
      group: 'Getting around',
      icon: 'home',
      title: 'Finding your way around',
      steps: [
        'The menu on the left has everything you edit, grouped the same way every time.',
        'Top right: the language you are editing, and your picture, which holds the theme, Settings, your profile and Log out. This guide is always the last item in the menu.',
        'Click the arrow beside the logo to fold the menu down to icons. Hover over it to see it in full.',
      ],
    },
    {
      id: 'edit',
      group: 'Pages',
      icon: 'file',
      title: 'Change a page',
      steps: [
        'Open Pages and click the page. The preview on the right shows the page as visitors will see it, and updates as you type.',
        'Your changes save on their own as a draft. Nothing changes on the website until you publish.',
        'Use the Phone, Tablet and Laptop buttons above the preview to check each size.',
      ],
      action: can('pages') ? { label: 'Open Pages', href: url('/collections/pages') } : undefined,
    },
    {
      id: 'sections',
      group: 'Pages',
      icon: 'form',
      title: 'Add, move or remove a section',
      steps: [
        'On a page, the "Add a section" panel lists every kind of section with a picture of it.',
        'Drag one into the page where you want it, or click it to add it at the end.',
        'Drag a section by its handle to move it. Its three-dot menu duplicates or removes it.',
      ],
    },
    {
      id: 'publish',
      group: 'Pages',
      icon: 'check',
      title: 'Publish your changes',
      steps: [
        '"Publish changes" puts the page live. The label beside the title always says what the website shows.',
        '"Unpublished changes" means the website still shows the last published version.',
        '"Undo changes" goes back to what is live. The clock icon shows every earlier version, and any of them can be restored.',
      ],
    },
    {
      id: 'media',
      group: 'Pictures',
      icon: 'image',
      title: 'Pictures and videos',
      steps: [
        'Upload in Media, or straight from the field on a page.',
        'Describe each picture for people who cannot see it. It also helps Google.',
        'Click the part of a photo that matters most, so it stays in view when the photo is cropped.',
      ],
      action: can('media') ? { label: 'Open Media', href: url('/collections/media') } : undefined,
    },
    ...(sites > 1
      ? [
          {
            id: 'sites',
            group: 'Getting around',
            icon: 'globe',
            title: 'Your websites',
            steps: [
              'This admin runs more than one website. The name at the top of the menu is the one you are working on.',
              'Click it to switch. Lists, new pages and Performance all follow your choice.',
              'Inside a page you stay on that page’s website. Go back to a list to switch.',
            ],
          },
        ]
      : []),
    ...(locales.length > 1
      ? [
          {
            id: 'languages',
            group: 'Getting around',
            icon: 'language',
            title: 'Other languages',
            steps: [
              'Choose the language to edit with the language icon top right. A small dot on it shows you are editing a translation, and the page says which.',
              'Only the words are translated. Sections, pictures and links are shared by every language.',
              'Anything not yet translated shows in the main language on the website. The coloured labels beside each page show how much is done.',
            ],
          },
        ]
      : []),
    {
      id: 'seo',
      group: 'Google',
      icon: 'seo',
      title: 'How you appear on Google',
      steps: [
        'SEO overview lists every page’s search title and description. Click one to change it there and then.',
        'The Redirects tab sends an old address to a new page, so old links keep working.',
      ],
      action: { label: 'Open SEO overview', href: url('/seo') },
    },
    {
      id: 'performance',
      group: 'Enquiries',
      icon: 'chart',
      title: 'Performance and enquiries',
      steps: [
        home === 'performance'
          ? 'Performance is the first page you see when you sign in. It shows every enquiry sent from the website, by form, by page and by day.'
          : 'Performance shows every enquiry sent from the website, by form, by page and by day.',
        'Each enquiry is also kept in Form Submissions, with everything the visitor filled in.',
      ],
      action: { label: 'Open Performance', href: home === 'performance' ? adminRoute : url('/performance') },
    },
    ...(views.claude && claudeReady(payload.config)
      ? [
          {
            id: 'claude',
            group: 'Pages',
            icon: 'chat',
            title: 'Ask Claude to make changes',
            steps: [
              'Add this website to Claude once, with your usual login here.',
              'Then ask for changes in plain words. They arrive here as drafts for you to check and publish.',
            ],
            action: { label: 'Set up Claude', href: url('/claude') },
          },
        ]
      : []),
    {
      id: 'account',
      group: 'Your account',
      icon: 'account',
      title: 'Your profile',
      steps: [
        'Click your picture top right for the theme, Settings, your profile and Log out.',
        'Add a photo on your profile. Without one, the admin shows your company’s logo or your initials.',
      ],
      action: { label: 'Open your profile', href: url('/account') },
    },
  ]

  // The project's own cards (webheroAdmin `guideCards`), after the card they name, else before the account card.
  const sections = [...standard]
  for (const card of guideCards) {
    if (card.collection && !can(card.collection)) continue
    const href = card.action?.href
    const section: GuideSection = {
      id: card.id,
      // Its own heading, else the heading of the card it follows.
      group: card.group ?? (card.after ? sections.find((s) => s.id === card.after)?.group : undefined) ?? 'More',
      icon: card.icon ?? 'file',
      title: card.title,
      steps: card.steps,
      action: card.action && href ? { label: card.action.label, href: href.startsWith('/') ? url(href as `/${string}`) : href } : undefined,
    }
    const after = card.after ? sections.findIndex((s) => s.id === card.after) : -1
    const at = after >= 0 ? after + 1 : Math.max(0, sections.findIndex((s) => s.id === 'account'))
    sections.splice(after >= 0 ? at : at || sections.length, 0, section)
  }

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
        <GuideClient name={(user as { name?: string } | null)?.name?.split(' ')[0]} sections={sections} />
      </Gutter>
    </DefaultTemplate>
  )
}
