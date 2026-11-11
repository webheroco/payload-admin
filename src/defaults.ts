/**
 * The admin defaults, applied to every collection and global, including the
 * ones other plugins add (Redirects, SEO, multi-tenant):
 *
 * - every list shows `listPageSize` rows;
 * - relationship and upload fields populate one level deep unless they say
 *   otherwise, and version history is capped;
 * - every checkbox, however deeply nested, renders as an on/off switch;
 * - `saveHelp` text sits in the status "i" note, so nothing pushes the form down;
 * - everything with Live Preview gets the preview toolbar (Phone, Tablet,
 *   Laptop, Fit, Custom) and the project's `previewControls`;
 * - everything with drafts gets the status pills and "Undo changes";
 * - everything with versions gets the Versions icon on the one header row;
 * - nothing shows the raw API link;
 * - the SEO plugin's tab is "SEO", and the page's `noIndex` switch moves into it,
 *   shown as "Indexed" (on = search engines may list it), the word the SEO
 *   overview uses;
 * - translated collections get a "Languages" column;
 * - the List/Grid switch gets the site's addresses for its page tiles, and
 *   every collection with pictures gets the switch;
 * - lists read only the columns on show (Payload's select API), plus the
 *   fields the package's tiles and links need;
 * - Columns offers top-level fields only: nothing inside a group, array,
 *   named tab or section shows as "Hero > Keep in view".
 */
import type { CollectionConfig, CustomComponent, Field, GlobalConfig, PayloadComponent } from 'payload'

import type { ResolvedOptions } from './options.js'

import { timingHooks } from './timing.js'

import {
  DOC_STATUS,
  SAVE_NOTE,
  LANGUAGES_CELL,
  LIST_GRID_SWITCH,
  PREVIEW_TOOLBAR,
  SERP_PREVIEW,
  SWITCH_FIELD,
  VERSIONS_BUTTON,
  YES_NO_CELL,
} from './paths.js'

/**
 * The SEO plugin's tab: named `meta`, or (with `tabbedUI`) unnamed and holding
 * the plugin's `meta` group.
 */
function isSeoTab(tab: { name?: string; fields: Field[] }): boolean {
  return tab.name === 'meta' || tab.fields.some((f) => 'name' in f && f.name === 'meta')
}

const INDEXED: Partial<Field> = {
  label: 'Indexed',
  admin: {
    description: 'On: search engines may list this page. Off for thank-you, landing and private pages.',
    components: {
      Field: { path: SWITCH_FIELD, clientProps: { invert: true } },
      Cell: { path: YES_NO_CELL, clientProps: { invert: true } },
    },
  },
}

/**
 * The SEO plugin's fields in SEO words, the same ones the SEO overview uses:
 * Title tag, Meta description, and the picture social media show, which
 * Open Graph calls og:image.
 */
const SEO_LABELS: Record<string, { label: string; description?: string }> = {
  title: { label: 'Title tag' },
  description: { label: 'Meta description' },
  image: {
    label: 'Social share image',
    description: 'Shown when the page is shared on social media or in a message (the Open Graph image). 1200 × 630 works everywhere.',
  },
}
/** The components without a Field key at all (an undefined Field renders nothing). */
const withoutField = (components: Record<string, unknown> | undefined) => {
  const { Field: _drop, ...rest } = components ?? {}
  return rest
}

type SeoPreviewProps = { routes: Record<string, string>; homeSlug: string }

const withSeoLabels = (fields: Field[], site?: SeoPreviewProps): Field[] =>
  fields.map((f) =>
    f.type === 'group' && 'name' in f && f.name === 'meta'
      ? {
          ...f,
          fields: f.fields.map((g) => {
            const name = 'name' in g ? g.name : ''
            const admin = ('admin' in g ? g.admin : {}) as Record<string, any>
            // The plugin's search-result preview looks nothing like Google's: ours does.
            if (name === 'preview' && g.type === 'ui') {
              const current = admin.components?.Field
              const props = current && typeof current === 'object' ? current.clientProps : {}
              return { ...g, admin: { ...admin, components: { ...admin.components, Field: { path: SERP_PREVIEW, clientProps: { ...props, ...site } } } } } as Field
            }
            const named = SEO_LABELS[name]
            if (!named) return g
            return {
              ...g,
              label: named.label,
              admin: {
                ...admin,
                ...(named.description ? { description: named.description } : {}),
                // The image: Payload's own upload field. The plugin's adds a red
                // "No image" tag, which says nothing the empty field doesn't.
                ...(name === 'image' ? { components: withoutField(admin.components) } : {}),
              },
            } as Field
          }),
        }
      : f,
  )

/** The page's `noIndex` checkbox, shown as "Indexed" (stored value unchanged). */
const asIndexed = (field: Field): Field =>
  ({ ...field, label: INDEXED.label, admin: { ...('admin' in field ? field.admin : {}), ...INDEXED.admin } }) as Field

const isNoIndex = (f: Field) => f.type === 'checkbox' && f.name === 'noIndex'

/**
 * The SEO plugin's tab is called "SEO", with a line saying what it is for,
 * and the page's `noIndex` switch moves into it from wherever the site put
 * it (top level or another tab). Moving a field between tabs changes no
 * data: an unnamed tab stores nothing of its own.
 */
export function withPlainSeoTab(fields: Field[] | undefined, site?: SeoPreviewProps): Field[] {
  const list = fields ?? []
  const seoTab = list.flatMap((f) => (f.type === 'tabs' ? f.tabs : [])).find(isSeoTab)
  // Only into an unnamed tab: a named one (`meta`) would change where the value is stored.
  const canMove = Boolean(seoTab && !('name' in seoTab && seoTab.name))
  let moved: Field | undefined
  const strip = (fs: Field[]) =>
    fs.filter((f) => {
      if (canMove && !moved && isNoIndex(f)) {
        moved = asIndexed(f)
        return false
      }
      return true
    })
  const top = strip(list).map((field) =>
    field.type === 'tabs'
      ? { ...field, tabs: field.tabs.map((tab) => (isSeoTab(tab) || ('name' in tab && tab.name) ? tab : { ...tab, fields: strip(tab.fields) })) }
      : isNoIndex(field)
        ? asIndexed(field)
        : field,
  )
  return top.map((field) =>
    field.type === 'tabs'
      ? {
          ...field,
          tabs: field.tabs.map((tab) =>
            isSeoTab(tab)
              ? {
                  ...tab,
                  label: tab.label === 'SEO' || tab.label === 'Google' || !tab.label ? 'SEO' : tab.label,
                  description: tab.description ?? 'How this page appears in search results and when it is shared.',
                  fields: withSeoLabels(moved ? [moved, ...tab.fields] : tab.fields.map((f) => (isNoIndex(f) ? asIndexed(f) : f)), site),
                }
              : { ...tab, fields: tab.fields.map((f) => (isNoIndex(f) ? asIndexed(f) : f)) },
          ),
        }
      : field,
  )
}

/** Every checkbox becomes a switch. The stored value is still a plain boolean. */
export function withSwitches(fields: Field[] | undefined): Field[] {
  return (fields ?? []).map((field) => {
    if (field.type === 'checkbox') {
      const components = field.admin?.components
      return {
        ...field,
        admin: {
          ...field.admin,
          // In a list it reads Yes or No, not true or false.
          components: { ...components, Field: components?.Field ?? SWITCH_FIELD, Cell: components?.Cell ?? YES_NO_CELL },
        },
      }
    }
    if (field.type === 'tabs') {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: withSwitches(tab.fields) })) }
    }
    if (field.type === 'blocks') {
      return { ...field, blocks: field.blocks.map((block) => ({ ...block, fields: withSwitches(block.fields) })) }
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: withSwitches(field.fields) } as Field
    }
    return field
  })
}

/**
 * A `ui` field stores nothing, so as a list column it only ever shows
 * "<No Palette>" and the like: it is left out of Columns unless it has a
 * Cell of its own (the Languages column does).
 */
export function withoutUiColumns(fields: Field[] | undefined): Field[] {
  return (fields ?? []).map((field) => {
    if (field.type === 'ui') {
      return field.admin?.components?.Cell ? field : ({ ...field, admin: { ...field.admin, disableListColumn: true } } as Field)
    }
    if (field.type === 'tabs') return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: withoutUiColumns(tab.fields) })) }
    if (field.type === 'blocks') return field
    if ('fields' in field && Array.isArray(field.fields)) return { ...field, fields: withoutUiColumns(field.fields) } as Field
    return field
  })
}

/** Relationship and upload fields populate one level unless they set their own maxDepth. */
export function withShallowRelations(fields: Field[] | undefined): Field[] {
  return (fields ?? []).map((field) => {
    if ((field.type === 'relationship' || field.type === 'upload') && field.maxDepth === undefined) {
      return { ...field, maxDepth: 1 }
    }
    if (field.type === 'tabs') {
      return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: withShallowRelations(tab.fields) })) }
    }
    if (field.type === 'blocks') {
      return {
        ...field,
        blocks: field.blocks.map((block) => ({ ...block, fields: withShallowRelations(block.fields) })),
      }
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      return { ...field, fields: withShallowRelations(field.fields) } as Field
    }
    return field
  })
}

const QUIET = { disableListColumn: true, disableListFilter: true }
/** Payload's file fields, which only mean something to a developer. */
const FILE_FIELDS: [string, 'text' | 'number'][] = [
  ['url', 'text'],
  ['thumbnailURL', 'text'],
  ['mimeType', 'text'],
  ['filesize', 'number'],
  ['width', 'number'],
  ['height', 'number'],
]

/**
 * Upload collections: Columns and Filters offer what an editor recognises
 * (file name, alt text, dates), not URL, MIME type, focal point, every
 * image size or a storage plugin's prefix. The fields stay as they are;
 * Payload merges these flags into its own upload fields by name.
 */
export function withQuietFileFields(collection: CollectionConfig): Field[] {
  const fields = collection.fields ?? []
  if (!collection.upload) return fields
  const upload = typeof collection.upload === 'object' ? collection.upload : {}
  const wanted: Field[] = FILE_FIELDS.map(([name, type]) => ({ name, type, admin: QUIET }) as Field)
  if (upload.focalPoint !== false || upload.imageSizes?.length || upload.resizeOptions) {
    for (const name of ['focalX', 'focalY']) wanted.push({ name, type: 'number', admin: QUIET } as Field)
  }
  if (upload.imageSizes?.length) {
    wanted.push({
      name: 'sizes',
      type: 'group',
      admin: QUIET,
      fields: upload.imageSizes.map(
        (size) =>
          ({
            name: size.name,
            type: 'group',
            admin: QUIET,
            fields: [...FILE_FIELDS.filter(([n]) => n !== 'thumbnailURL'), ['filename', 'text']].map(
              ([n, t]) => ({ name: n, type: t, admin: QUIET }) as Field,
            ),
          }) as Field,
      ),
    } as Field)
  }
  // A storage plugin's prefix and any field named with a leading underscore are plumbing.
  const mine = fields.map((f) => ('name' in f && (f.name === 'prefix' || f.name.startsWith('_')) ? quietAll(f) : f))
  return mergeQuiet(mine, wanted)
}

/** A field and everything inside it, out of Columns and Filters. */
function quietAll(field: Field): Field {
  const quieted = { ...field, admin: { ...('admin' in field ? field.admin : {}), ...QUIET } } as Field
  if ('fields' in quieted && Array.isArray(quieted.fields)) {
    return { ...quieted, fields: quieted.fields.map(quietAll) } as Field
  }
  return quieted
}

/**
 * Quiet each wanted field: one the collection already has (a storage plugin
 * adds `url` and `sizes` before this runs) keeps its definition and gains the
 * flags, inside groups too; a missing one is added with only the flags, which
 * Payload merges into its own upload field of that name.
 */
function mergeQuiet(fields: Field[], wanted: Field[]): Field[] {
  const byName = new Map(wanted.map((w) => ['name' in w ? w.name : '', w]))
  const seen = new Set<string>()
  const merged = fields.map((f) => {
    const name = 'name' in f ? f.name : ''
    const want = byName.get(name)
    if (!want) return f
    seen.add(name)
    const quieted = quietAll(f)
    if ('fields' in quieted && Array.isArray(quieted.fields) && 'fields' in want && Array.isArray(want.fields)) {
      return { ...quieted, fields: mergeQuiet(quieted.fields, want.fields) } as Field
    }
    return quieted
  })
  return [...merged, ...wanted.filter((w) => !seen.has('name' in w ? w.name : ''))]
}

/** Containers whose fields sit at the top level of the document (no "Group >" prefix). */
const isLayout = (field: Field) => field.type === 'row' || field.type === 'collapsible' || (field.type as string) === 'tabs'

/**
 * Columns: only what an editor can read in a cell. Fields inside a group,
 * an array, a named tab or a section, and array and section fields
 * themselves ("2 Layouts - Hero, FAQ"), are left out of Columns. Filters
 * keep them. A field the collection names in `admin.defaultColumns` stays.
 */
export function withFlatColumns(fields: Field[] | undefined, keep: Set<string> = new Set(), nested = false): Field[] {
  const off = (field: Field): Field =>
    'name' in field && keep.has(field.name) && !nested
      ? field
      : ({ ...field, admin: { ...('admin' in field ? field.admin : {}), disableListColumn: true } } as Field)
  return (fields ?? []).map((field) => {
    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({ ...tab, fields: withFlatColumns(tab.fields, keep, nested || 'name' in tab) })),
      } as Field
    }
    if (isLayout(field) && 'fields' in field) return { ...field, fields: withFlatColumns(field.fields as Field[], keep, nested) } as Field
    if (field.type === 'group') {
      // An unnamed group is only a box on the form; its fields are top level.
      const named = 'name' in field && Boolean(field.name)
      return { ...field, fields: withFlatColumns(field.fields, keep, nested || named) } as Field
    }
    if (field.type === 'array' || field.type === 'blocks') return off(field)
    if (nested && field.type !== 'ui') return off(field)
    return field
  })
}

/** The top-level upload fields (outside groups and arrays), by name. */
function topLevelPictures(fields: Field[] | undefined): string[] {
  const out: string[] = []
  for (const field of fields ?? []) {
    if (field.type === 'upload' && 'name' in field && !field.hasMany) out.push(field.name)
    else if (field.type === 'tabs') {
      for (const tab of field.tabs) if (!('name' in tab && tab.name)) out.push(...topLevelPictures(tab.fields))
    } else if (isLayout(field) && 'fields' in field) out.push(...topLevelPictures(field.fields as Field[]))
  }
  return out
}

/** Fields the package's tiles, status pills and links read from a list row. */
function listSelect(collection: CollectionConfig): Record<string, true> {
  const names = new Set<string>()
  const top = (fields: Field[] | undefined) => {
    for (const field of fields ?? []) {
      if ('name' in field && field.name) names.add(field.name)
      else if (field.type === 'tabs') {
        for (const tab of field.tabs) if (!('name' in tab && tab.name)) top(tab.fields)
      } else if (isLayout(field) && 'fields' in field) top(field.fields as Field[])
    }
  }
  top(collection.fields)
  const wanted = ['title', 'name', 'slug', 'path', 'alt', 'decorative', collection.admin?.useAsTitle ?? '']
  const select: Record<string, true> = {}
  for (const name of wanted) if (name && names.has(name)) select[name] = true
  if (collection.upload) {
    for (const name of ['filename', 'mimeType', 'url', 'thumbnailURL', 'filesize', 'sizes']) select[name] = true
  }
  if (collection.versions && typeof collection.versions === 'object' && collection.versions.drafts) select._status = true
  return select
}

/** A list column of EN / FR / ES chips. `ui` fields store nothing, so no migration. */
function withLanguagesColumn(fields: Field[], slug: string, options: ResolvedOptions): Field[] {
  if (!options.translated.includes(slug)) return fields
  const column: Field = {
    name: 'languages',
    type: 'ui',
    label: 'Languages',
    // No Field component: it shows in the list only.
    admin: { components: { Cell: LANGUAGES_CELL } },
  }
  return [...fields, column]
}

function pathOf(component: PayloadComponent): string | undefined {
  if (typeof component === 'string') return component
  if (component && typeof component === 'object' && 'path' in component) return component.path
  return undefined
}

/**
 * The List/Grid switch needs the site's addresses to load each page tile.
 * A collection with pictures (an upload collection, or a top-level upload
 * field) gets the switch if it hasn't one.
 */
function withGridRoutes(collection: CollectionConfig, options: ResolvedOptions): CustomComponent[] | undefined {
  let components = collection.admin?.components?.beforeListTable
  const has = components?.some((c) => pathOf(c) === LIST_GRID_SWITCH)
  const pictures = collection.upload ? [] : topLevelPictures(collection.fields)
  if (!has && (collection.upload || pictures.length)) {
    components = [
      ...(components ?? []),
      { path: LIST_GRID_SWITCH, clientProps: { collectionSlug: collection.slug, ...(pictures.length ? { picture: pictures } : {}) } },
    ]
  }
  return components?.map((component): CustomComponent => {
    if (pathOf(component) !== LIST_GRID_SWITCH) return component
    const base = typeof component === 'string' ? { path: component } : (component as Exclude<CustomComponent, string | false>)
    return {
      ...base,
      clientProps: {
        routes: options.routes,
        homeSlug: options.homeSlug,
        media: Boolean(collection.upload),
        ...(collection.admin?.useAsTitle ? { titleField: collection.admin.useAsTitle } : {}),
        drafts: Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts),
        ...base.clientProps,
      },
    }
  })
}

export function collectionDefaults(
  collection: CollectionConfig,
  options: ResolvedOptions,
  previewControls: CustomComponent[],
): CollectionConfig {
  const previewable = options.livePreview.collections.includes(collection.slug)
  const components = collection.admin?.components
  const beforeControls = [
    ...(components?.edit?.beforeDocumentControls ?? []),
    // Phone / Tablet / Laptop / Fit / Custom inside the preview toolbar.
    ...(previewable ? [PREVIEW_TOOLBAR, ...previewControls] : []),
    // Versions as an icon beside Publish (the tabs row is hidden).
    ...(collection.versions ? [VERSIONS_BUTTON] : []),
  ]
  const hasDrafts = Boolean(
    collection.versions && typeof collection.versions === 'object' && collection.versions.drafts,
  )
  // Without drafts there is no status group to hold the save help, so it gets
  // its own "i" beside Save.
  if (!hasDrafts && options.saveHelp[collection.slug]) {
    beforeControls.unshift({ path: SAVE_NOTE, clientProps: { help: options.saveHelp[collection.slug] } })
  }
  const beforeListTable = withGridRoutes(collection, options)
  const keepColumns = new Set((collection.admin?.defaultColumns ?? []).map(String))
  return {
    ...collection,
    ...(collection.versions
      ? {
          versions: {
            maxPerDoc: options.maxVersions,
            ...(typeof collection.versions === 'object' ? collection.versions : {}),
          },
        }
      : {}),
    ...(options.slowLog === false
      ? {}
      : (() => {
          const t = timingHooks(collection.slug, options.slowLog)
          return {
            hooks: {
              ...collection.hooks,
              beforeOperation: [t.beforeOperation, ...(collection.hooks?.beforeOperation ?? [])],
              afterOperation: [...(collection.hooks?.afterOperation ?? []), t.afterOperation],
            },
          }
        })()),
    // The list reads only the columns on show, plus what the tiles and pills need.
    ...(collection.admin?.enableListViewSelectAPI === false
      ? {}
      : { forceSelect: { ...listSelect(collection), ...(collection.forceSelect as object) } as never }),
    admin: {
      hideAPIURL: true,
      enableListViewSelectAPI: true,
      ...collection.admin,
      pagination: {
        defaultLimit: options.listPageSize,
        limits: [options.listPageSize, 50, 100],
        ...collection.admin?.pagination,
      },
      components: {
        ...components,
        ...(beforeListTable ? { beforeListTable } : {}),
        edit: {
          ...components?.edit,
          // The editor's-words status pills, "Undo changes" and the dates note.
          ...(hasDrafts
            ? { Status: components?.edit?.Status ?? (options.saveHelp[collection.slug] ? { path: DOC_STATUS, clientProps: { help: options.saveHelp[collection.slug] } } : DOC_STATUS) }
            : {}),
          ...(beforeControls.length ? { beforeDocumentControls: beforeControls } : {}),
        },
      },
    },
    fields: withLanguagesColumn(
      withFlatColumns(
        withoutUiColumns(withShallowRelations(withSwitches(withPlainSeoTab(withQuietFileFields(collection), { routes: options.routes, homeSlug: options.homeSlug })))),
        keepColumns,
      ),
      collection.slug,
      options,
    ),
  }
}

export function globalDefaults(
  global: GlobalConfig,
  options: ResolvedOptions,
  previewControls: CustomComponent[],
): GlobalConfig {
  const previewable = options.livePreview.globals.includes(global.slug)
  const components = global.admin?.components
  const beforeControls = [
    ...(components?.elements?.beforeDocumentControls ?? []),
    ...(previewable ? [PREVIEW_TOOLBAR, ...previewControls] : []),
    ...(global.versions ? [VERSIONS_BUTTON] : []),
  ]
  // Globals have no status group of ours, so the save help gets its own "i".
  if (options.saveHelp[global.slug]) {
    beforeControls.unshift({ path: SAVE_NOTE, clientProps: { help: options.saveHelp[global.slug] } })
  }
  return {
    ...global,
    ...(global.versions
      ? { versions: { max: options.maxVersions, ...(typeof global.versions === 'object' ? global.versions : {}) } }
      : {}),
    admin: {
      hideAPIURL: true,
      ...global.admin,
      ...(beforeControls.length
        ? {
            components: {
              ...components,
              // Globals keep their document controls under `elements`.
              elements: { ...components?.elements, beforeDocumentControls: beforeControls },
            },
          }
        : {}),
    },
    fields: withShallowRelations(withSwitches(withPlainSeoTab(global.fields, { routes: options.routes, homeSlug: options.homeSlug }))),
  }
}
