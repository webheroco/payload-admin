# Changelog

## 0.1.0

First release, moved out of the `client-payload` skill's templates
(`templates/components/admin/` and `templates/cms/admin-defaults.ts`).

- `webheroAdmin()` plugin: sets the rail menu, the top-right menus, the
  SEO overview, Performance and guide pages, and the admin defaults, from
  plain options instead of edited template files.
- Page addresses (`routes`, `homeSlug`) are options, so the SEO overview and
  the List/Grid page tiles no longer import the site's `cms/paths.ts`.
- The SEO overview lists only collections that exist (a site
  without Posts would have errored).
- Performance reads the skill's one Submissions collection by default, as
  well as the Form Builder, and follows the chosen site on multi-site.
- The SEO plugin's tab is renamed "Google" with `tabbedUI` too (it only
  worked when the tab was named `meta`).
- The general admin styles that were in the template's `custom.css`
  (switches, save help, List/Grid, read-only fields, Live Preview on small
  screens) are part of the package's styles.
