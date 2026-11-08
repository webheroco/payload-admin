# Changelog

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
  `/api/reviews/publish-due` for scheduled changes. Ported from Quartix.
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
