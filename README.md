# @webheroco/payload-admin

The WebHero Payload admin, shared by every client site: the icon rail menu,
the language, guide and account menus, the one-row document header with the
status pills and preview toolbar, the section palette, List/Grid, the SEO
overview, the Performance page and the "How to use the admin" guide, plus the
admin defaults every collection gets.

A change made here reaches every site that updates the package, so an admin
improvement is made once, not copied into each repo. What the admin should
look like and why is the `client-payload` skill's
[admin UI standard](https://github.com/webheroco/agent-skills/blob/main/skills/client-payload/references/admin-ui.md).
This package is the code for it.

Built and checked on Payload 3.93 and Next.js 16.

## What stays in the site

Only what differs per client:

- the logo and icon (`admin.components.graphics`);
- the brand colours (`app/(payload)/custom.css`);
- the dashboard's "needs attention" counts and shortcuts;
- the click-to-edit bridge for the site's preview (passed in as `previewControls`);
- on multi-site, `TenantDefault` (it knows the site's domains).

## Install

1. At the app's root (next to its `package.json`), add `.npmrc`:

   ```
   @webheroco:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
   ```

   `GITHUB_PACKAGES_TOKEN` is a read-only token for GitHub Packages, set once
   for the whole Vercel team (a shared environment variable linked to every
   project) and once in the Claude environment. Nothing per site.

2. Install it at an exact version:

   ```
   npm install --save-exact @webheroco/payload-admin
   ```

3. Add the plugin last in `plugins`, so collections from other plugins get the
   defaults too:

   ```ts
   import { webheroAdmin } from '@webheroco/payload-admin'

   plugins: [
     seoPlugin({ ... }),
     redirectsPlugin({ ... }),
     webheroAdmin({
       routes: { pages: '/:slug', posts: '/blog/:slug' },
       livePreview: { collections: ['pages', 'posts'], globals: ['navigation'] },
       previewControls: ['/components/admin/VisualEditingBridge#VisualEditingBridge'],
       saveHelp: SAVE_HELP_TEXT,
       translated: TRANSLATED_COLLECTIONS,
     }),
   ],
   ```

4. Load the styles in `app/(payload)/layout.tsx`, after Payload's and before
   the site's own:

   ```ts
   import '@payloadcms/next/css'
   import '@webheroco/payload-admin/styles.css'
   import './custom.css'
   ```

5. Regenerate the import map: `npx payload generate:importmap`.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `routes` | `{ pages: '/:slug', posts: '/blog/:slug' }` | Where each collection lives on the site, for page tiles and the SEO overview. A document with its own `path` field uses that. |
| `homeSlug` | `home` | The page served at `/`. |
| `seo` | Pages and Posts, where they exist | The collections in the SEO overview, and what a row is called. |
| `enquiries` | the Form Builder if `form-submissions` exists, else `{ collection: 'submissions', formField: 'form', pageField: 'page' }` | Where Performance counts enquiries. |
| `livePreview` | none | Collections and globals with Live Preview; they get the preview toolbar. |
| `previewControls` | none | More components beside the preview toolbar, such as the site's click-to-edit bridge. |
| `saveHelp` | none | One line per slug at the top of the edit view saying how saving works there. |
| `translated` | none | Collections that get the Languages column. |
| `listPageSize` | 25 | Rows per list page. |
| `maxVersions` | 50 | Versions kept per document. |
| `views` | all on | `{ seo, performance, guide, sections }`: `false` turns a page off. |
| `approvals` | off | `true`, or `{ approverRoles, roleField, only }`: sign-off before anything goes live (see below). |
| `home` | `'performance'` | What `/admin` opens on. Performance replaces the dashboard; `'dashboard'` keeps Payload's dashboard and puts Performance at `/performance`. |

The plugin sets the menu (`Nav`), the top-right actions and the three pages.
Anything the project sets itself is kept: its own `Nav`, a view at the same
key (a project's own guide, say), or extra actions.

## Components

For fields and list slots, use the path constants rather than typing the
paths:

```ts
import { BLOCK_PALETTE, LIST_GRID_SWITCH } from '@webheroco/payload-admin'

admin: { components: { beforeListTable: [{ path: LIST_GRID_SWITCH, clientProps: { collectionSlug: 'pages', defaultView: 'grid' } }] } }
```

| Entry | Holds |
| --- | --- |
| `@webheroco/payload-admin` | the plugin, the option types, `publicPath`, the path constants. No React, so Payload's CLI can load it. |
| `@webheroco/payload-admin/rsc` | server components: `NavRail`, `AccountMenu`, `SeoOverview`, `Performance`, `PerformanceHome`, `Sections`, `Reviews`, `Guide`, `LanguagesCell` |
| `@webheroco/payload-admin/client` | client components: `HelpButton`, `LanguageMenu`, `HeaderRow`, `SwitchField`, `SaveHelp`, `PreviewToolbar`, `DocStatus`, `VersionsButton`, `BlockPalette`, `ListGridSwitch`, and `Mark`, `Icon`, `useMenu`, `useFilter`, `useSites` for a project's own pieces |
| `@webheroco/payload-admin/multi-site` | `SiteMenu` (needs `@payloadcms/plugin-multi-tenant`) |
| `@webheroco/payload-admin/styles.css` | all the admin styles, compiled |
| `@webheroco/payload-admin/styles.scss` | the same in Sass |

## Updating a site

`npm install --save-exact @webheroco/payload-admin@latest`, regenerate the
import map, and check the admin on the preview at 1440, 1024 and 390px wide,
in light and dark. [CHANGELOG.md](CHANGELOG.md) says what changed.

## Changing the package

See [AGENTS.md](AGENTS.md).

## Approvals (optional)

`webheroAdmin({ approvals: true })` puts every collection and global with
drafts through sign-off. Editors get "Submit for review" instead of Publish,
and the server refuses their publishes. Approvers (users whose `role` is
`super-admin` or `client-admin`, change with `approverRoles` and `roleField`)
publish, schedule or send back with a note, from the document or the Reviews
page (`/admin/reviews`, a list and a board). Emails go through Payload's email
adapter. It adds a hidden `reviews` collection, so run a migration.

Scheduled changes go live when `GET /api/reviews/publish-due` runs. Add a
Vercel cron for it and set `CRON_SECRET` in production:

```json
{ "crons": [{ "path": "/api/reviews/publish-due", "schedule": "*/5 * * * *" }] }
```

On Vercel's Hobby plan crons run once a day, so use a daily schedule there or
upgrade.
