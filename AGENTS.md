# AGENTS.md

## What this is

`@webheroco/payload-admin`: the WebHero Payload admin UI, installed by every
client site from the file on its GitHub release. The rules it implements are the
`client-payload` skill's admin UI standard
(`webheroco/agent-skills`, `skills/client-payload/references/admin-ui.md`).
When you change how the admin behaves, update that file in the same piece of
work (a separate PR there), so the rule and the code agree.

## Layout

- `src/index.ts`: the entry `payload.config.ts` imports. No React or Next in
  it or in anything it imports (`plugin.ts`, `options.ts`, `defaults.ts`,
  `routes.ts`, `paths.ts`), because Payload's CLI loads the config in Node.
- `src/rsc.ts`, `src/client.ts`, `src/multi-site.ts`: the component entries
  the import map points at. Client files start with `'use client'`.
- `src/components/`: one folder per area, each with its styles as a Sass
  partial. `src/styles/admin-ui.scss` pulls them together and is compiled to
  `dist/admin-ui.css`.
- Relative imports end in `.js`.

## Rules

- **Nothing project-specific.** Anything that differs between clients is an
  option on `webheroAdmin()` with a sensible default, never a hard-coded slug,
  address or brand. Options must be plain data, because they are stored on
  `admin.custom` and passed to client components as props.
- **No client names anywhere.** This repo is public. Never name a client,
  a client's site, a person or a client's incident in code, comments, the
  CHANGELOG, commit messages, PR titles or PR descriptions. Say what the
  change does for any site ("a three-site admin", "a site with a shop").
- **Server components read options with `readOptions(payload.config)`.**
  Client components get them as props, injected by the plugin.
- **Payload's theme variables only** (`--theme-bg`, `--theme-elevation-*`,
  `--theme-text`), so light and dark both work.
- **Keep the peer range honest.** Raise the minimum Payload version when you
  use something newer.

## Releasing

1. Raise `version` in `package.json` (patch for fixes, minor for new things,
   major when a site has to change its config) and add a CHANGELOG entry
   saying what an editor or a site will notice.
2. Merge to `main`. The Publish workflow publishes the new version and tags it.

## Checking a change

`npm run typecheck`, `npm run build` and `npm test` must pass (CI runs them).
For anything visible, also install the packed package (`npm pack`) into a
Payload app and check the admin at 1440, 1024 and 390px wide, in light and
dark, with screenshots in the PR.

Check it against every shape of site the `client-payload` skill builds, not
just one. Before a release, the packed package must work in:

- a single-site app and a multi-site app (`@payloadcms/plugin-multi-tenant`,
  two or more sites): every list, overview and page follows the site menu,
  and nothing frames or fetches another site's pages;
- an app whose sections are a shared library in the config's `blocks`, used
  through `blockReferences` (the skill's default), and one with inline blocks;
- an app with a shop on Medusa beside it (`links` to the shop's admin);
- an app with `trailingSlash: true`.

When a site's move onto the package turns up a gap, add the case to this list
and to `test/`, so the next site isn't the one that finds it.
