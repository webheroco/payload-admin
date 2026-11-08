/**
 * The admin defaults, applied to every collection and global, including the
 * ones other plugins add (Redirects, SEO, multi-tenant):
 *
 * - every list shows `listPageSize` rows;
 * - relationship and upload fields populate one level deep unless they say
 *   otherwise, and version history is capped;
 * - every checkbox, however deeply nested, renders as an on/off switch;
 * - each edit view says how saving works at the top of its form (`saveHelp`);
 * - everything with Live Preview gets the preview toolbar (Phone, Tablet,
 *   Laptop, Fit, Custom) and the project's `previewControls`;
 * - everything with drafts gets the status pills and "Undo changes";
 * - everything with versions gets the Versions icon on the one header row;
 * - nothing shows the raw API link;
 * - the SEO plugin's "SEO" tab is called "Google", with a line saying what it is for;
 * - translated collections get a "Languages" column;
 * - the List/Grid switch gets the site's addresses for its page tiles.
 */
import type { CollectionConfig, CustomComponent, Field, GlobalConfig, PayloadComponent } from 'payload'

import type { ResolvedOptions } from './options.js'

import {
  DOC_STATUS,
  LANGUAGES_CELL,
  LIST_GRID_SWITCH,
  PREVIEW_TOOLBAR,
  SAVE_HELP,
  SWITCH_FIELD,
  VERSIONS_BUTTON,
} from './paths.js'

/**
 * The SEO plugin's tab: named `meta`, or (with `tabbedUI`) unnamed and holding
 * the plugin's `meta` group.
 */
function isSeoTab(tab: { name?: string; fields: Field[] }): boolean {
  return tab.name === 'meta' || tab.fields.some((f) => 'name' in f && f.name === 'meta')
}

/** The SEO plugin names its tab "SEO", which editors don't read as anything. */
export function withPlainSeoTab(fields: Field[] | undefined): Field[] {
  return (fields ?? []).map((field) =>
    field.type === 'tabs'
      ? {
          ...field,
          tabs: field.tabs.map((tab) =>
            tab.label === 'SEO' && isSeoTab(tab)
              ? {
                  ...tab,
                  label: 'Google',
                  description: tab.description ?? 'How this page appears in Google results and when it is shared.',
                }
              : tab,
          ),
        }
      : field,
  )
}

/** Every checkbox becomes a switch. The stored value is still a plain boolean. */
export function withSwitches(fields: Field[] | undefined): Field[] {
  return (fields ?? []).map((field) => {
    if (field.type === 'checkbox') {
      if (field.admin?.components?.Field) return field
      return { ...field, admin: { ...field.admin, components: { ...field.admin?.components, Field: SWITCH_FIELD } } }
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

/** A `ui` field at the top of the form. `ui` fields store nothing, so no migration. */
function withSaveHelp(fields: Field[], slug: string, options: ResolvedOptions): Field[] {
  const text = options.saveHelp[slug]
  if (!text) return fields
  const help: Field = {
    name: 'saveHelp',
    type: 'ui',
    admin: { components: { Field: { path: SAVE_HELP, clientProps: { text } } } },
  }
  return [help, ...fields]
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

/** The List/Grid switch needs the site's addresses to load each page tile. */
function withGridRoutes(components: CustomComponent[] | undefined, options: ResolvedOptions): CustomComponent[] | undefined {
  return components?.map((component): CustomComponent => {
    if (pathOf(component) !== LIST_GRID_SWITCH) return component
    const base = typeof component === 'string' ? { path: component } : (component as Exclude<CustomComponent, string | false>)
    return {
      ...base,
      clientProps: { routes: options.routes, homeSlug: options.homeSlug, ...base.clientProps },
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
  const beforeListTable = withGridRoutes(components?.beforeListTable, options)
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
    admin: {
      hideAPIURL: true,
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
          ...(hasDrafts ? { Status: components?.edit?.Status ?? DOC_STATUS } : {}),
          ...(beforeControls.length ? { beforeDocumentControls: beforeControls } : {}),
        },
      },
    },
    fields: withLanguagesColumn(
      withSaveHelp(withShallowRelations(withSwitches(withPlainSeoTab(collection.fields))), collection.slug, options),
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
    fields: withSaveHelp(withShallowRelations(withSwitches(withPlainSeoTab(global.fields))), global.slug, options),
  }
}
