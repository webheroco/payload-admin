# Changelog

## 0.4.0

No schema change. Run `payload generate:importmap` after updating (new
`ListPanels` and `YesNoCell`).

- Payload's own lists (Media, enquiries, anything without a view of ours):
  - no big heading, since the breadcrumb already names the list;
  - search, Columns, Filters and Create new share one top row that stays in view;
  - the table scrolls inside its box, sideways too, with its heading row fixed;
  - Columns and Filters open in the right-hand panel, close on Escape or a
    click outside, and Filters starts with a condition to fill in;
  - an empty list says "Nothing to show." in plain words;
  - on/off settings read Yes or No, not `true` and `false`.
- Upload collections: URL, MIME type, size, width, height, focal point,
  every image size, a storage plugin's `prefix` and fields named with a
  leading underscore are left out of Columns and Filters. `ui` fields
  (the section palette) are left out of Columns.
- SEO overview, Schema and Approvals tables: same scroll box and fixed
  heading row; the tabs row stays in view.
- Schema tab: results are kept in the browser. Opening the tab re-reads only
  pages never checked or changed since; "Check again" reads them all.
- SEO checks: a title tag or meta description in capitals is amber.
- One help icon: every page and status note uses the same "?" icon. The
  guide is the last item in the menu, and the "?" top right is gone (a site
  that still lists `HelpButton` in its actions has it taken out).
- Guide: grouped under headings (Getting around, Pages, Pictures, Google,
  Enquiries, Your account) instead of a row of links. `guideCards` take a
  `group`; without one a card joins the heading of the card it follows.
- Performance: the site's name no longer repeats the site menu.
- Grid: as many tiles as fit, at least four across on a laptop.
- Speed: Sections reads only which sections each page uses, not their
  contents; Performance reads only the fields it counts.

## 0.3.3

No schema change.

- List/Grid `picture`: the picture fields are read for the documents on show
  in their own request (latest draft, as the list shows it), so tiles find
  pictures even when the list's query holds only the visible columns.
  Covered by `test/grid-pictures.test.mjs`.

## 0.3.2

- `saveHelp` now shows on collections and globals without drafts (Media,
  Team, settings) too: an "i" beside Save holds it, since they have no status
  group. Hidden on phones, like the dates note. Run
  `payload generate:importmap` after updating (new `SaveNote`).

## 0.3.1

Nothing changes for a site that sets none of the new options. Run
`payload generate:importmap` after updating.

- Site menu: `wordmarks` (by domain) shows a brand's wordmark image in place
  of the small mark, name and domain, and `mark` is the square image used
  when the menu is collapsed. For brands whose logo is a wordmark.
- Phones: the editor's icon buttons keep their size when a site adds its own
  button beside Publish; only the Publish button gives way.

## 0.3.0

Multi-site fixes and room for what one site has that others don't, found
moving a three-site admin with a Medusa shop onto the package.
Nothing changes for a site that sets none of the new options. No schema
change. Run `payload generate:importmap` after updating.

- Multi-site: the SEO overview (pages and redirects) and the Sections page
  follow the site menu, like every list and Performance. Before, they listed
  every site's pages together.
- Sections reads only each page's title and sections, not whole pages.
- The section palette lists sections shared through the config's `blocks`
  and referenced from Pages with `blockReferences`, as the skill builds
  them. Before, it was empty on such a site.
- List/Grid: `picture` on the switch shows each page's picture instead of
  the live page in a frame (`picture: ['gallery.image', 'meta.image']`, the
  first found). Use it on multi-site, where a page of another site can't be
  framed from this domain, and on big sites. `remember: false` opens every
  visit on `defaultView`.
- `links`: links out of the admin at the foot of the menu, opened in a new
  tab with a small arrow, such as the shop's own admin.
- `websiteLink: true`: "View website" in the menu, for the site chosen in
  the site menu (its `origin`), else `serverURL`.
- `guideCards`: more cards for "How to use the admin", each placed after a
  card you name, shown only to people who can read its `collection`.
- New icons: cart, box, receipt, stock, external. `submissions` gets the
  inbox icon.
- The menu marks the current screen with or without a trailing slash
  (Next's `trailingSlash`).
- Guide: the collapse arrow is beside the logo, not at the foot of the menu.

## 0.2.0

- Published as a file on each GitHub release (public), installed by its
  URL: no registry, no token.
- Nothing pushes the editor's fields down. The save help moves into the
  status "i" note, and the review banner is gone: the request's state is a
  pill in the status group ("Waiting for approval", "Changes requested",
  "Goes live …") with who, when and the message or note in its tip.
- Approval wording: "Submit for approval"; approvers deciding on someone
  else's change see "Request changes", "Approve for a date" and "Approve and
  publish". The menu page is "Approvals". "Sent back" is "Changes requested"
  everywhere (emails too); stored values are unchanged.
- Approve and publish asks for an optional note to the author, with quick
  notes ("Great job, thank you!") and "I changed something myself before
  publishing" (ticked when the approver has unsaved edits). The author's
  email carries both, and for a week their status group shows "Approved by
  …" with the note in its tip. New fields on the approval requests
  collection (`approvalNote`, `approverEdited`): create a migration.
- The SEO plugin's preview is replaced by a Google-style search result
  (`SerpPreview`), and the social share image is Payload's own upload field
  without the red "No image" tag. Run `payload generate:importmap`.
- SEO tab fields read Title tag, Meta description and Social share image
  (the Open Graph image), matching the SEO overview.
  `ReviewBanner` still exports (it renders nothing) so old import maps work.
- The SEO plugin's tab is "SEO" (was "Google"). A `noIndex` checkbox moves
  into it from the Content tab and shows as an "Indexed" switch (on = search
  engines may list it), the word the SEO overview uses. Stored value and
  data unchanged. `SwitchField` takes `invert`.
- One set of corners: every control (Payload's inputs, search, selects,
  buttons, pills) uses `--cms-radius` (8px), cards, panels, menus and
  dialogs `--cms-radius-lg` (12px). Payload's `--style-radius-*` follow them.
- The document's buttons are all 34px with 8px between each, and the row
  and the preview toolbar end 16px from the edge, under the top-right menus.
- CI runs on pull requests only and cancels superseded runs.

## 0.1.0

First release, moved out of the `client-payload` skill's templates
(`templates/components/admin/` and `templates/cms/admin-defaults.ts`).

- `webheroAdmin()` plugin: sets the rail menu, the top-right menus, the
  SEO overview, Performance and guide pages, and the admin defaults, from
  plain options instead of edited template files.
- Page addresses (`routes`, `homeSlug`) are options, so the SEO overview and
  the List/Grid page tiles no longer import the site's `cms/paths.ts`.
- SEO overview: the first tab is "Metadata" and its columns are Page, Slug,
  Type, Title tag, Meta description and Indexed. Lengths are a coloured dot
  beside the count (red empty, amber too short or long, green good) with
  the words in its tip; the "need attention" chip and the unpublished dot
  beside the page name are gone. Filters has Type, Status, Indexed and both
  lengths; it starts on Indexed, so pages hidden from search are filtered
  out, and the Filters badge counts that as one.
- Performance is the admin's home page (`home: 'performance'`, the default):
  it replaces the dashboard of links, and the menu has no Dashboard link.
  `home: 'dashboard'` keeps the dashboard with Performance at /performance.
  Run `payload generate:importmap` after updating (new `PerformanceHome`).
- SEO overview: a Schema tab. It reads each indexed page as the public sees
  it and checks its JSON-LD against Google's rich result rules (red errors,
  amber recommended properties missing, green valid). Site-wide types
  (Organization, LocalBusiness, WebSite, BreadcrumbList) are one card each at
  the top with how many pages carry them; the table and its Type filter only
  list the page types the site actually uses.
- Sections (`/sections`, on by default): every section the site can use, with
  its picture, description, group and the pages using it. Read only.
- Approvals (`approvals: true`, off by default): Submit for review, Send
  back, Schedule, a Reviews page with list and board, emails, and
  `/api/reviews/publish-due` for scheduled changes.
- Every table cell is pinned to the top; Page and Slug columns are wider;
  slugs link to the live page in a new tab. Schema findings mark errors red
  and suggestions ("Could add image") amber.
- The SEO overview lists only collections that exist (a site
  without Posts would have errored).
- Performance reads the skill's one Submissions collection by default, as
  well as the Form Builder, and follows the chosen site on multi-site.
- The SEO plugin's tab is renamed "Google" with `tabbedUI` too (it only
  worked when the tab was named `meta`).
- The menu has no group headings or dividers, so it keeps the same shape
  open and collapsed and nothing jumps. "Collapse menu" is an icon at the top
  right of the open menu; collapsed, clicking the logo or hovering the edge
  opens it.
- The SEO overview gives the page, its address and its type their own
  one-line columns. Unpublished changes are an amber dot beside the name.
- The account picture sits in the top right corner, lined up with the
  preview's "open in a new tab" arrow.
- The section palette works on any collection (`blocksField` prop, default
  `layout`); redirects keep string IDs; localized slugs show their address.
- The general admin styles that were in the template's `custom.css`
  (switches, save help, List/Grid, read-only fields, Live Preview on small
  screens) are part of the package's styles.
