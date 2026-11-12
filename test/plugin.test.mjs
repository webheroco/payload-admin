// Runs against the built package (npm run build first): the entry Payload's
// CLI loads must work in plain Node, with no React or Next in it.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LIST_GRID_SWITCH, NAV_RAIL, PREVIEW_TOOLBAR, SWITCH_FIELD, publicPath, webheroAdmin } from '../dist/index.js'

const base = () => ({
  admin: { components: { actions: ['/components/admin/Own#Own'] } },
  collections: [
    {
      slug: 'pages',
      versions: { drafts: true },
      admin: { components: { beforeListTable: [{ path: LIST_GRID_SWITCH, clientProps: { collectionSlug: 'pages' } }] } },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'hidden', type: 'checkbox' },
        {
          type: 'tabs',
          tabs: [
            { label: 'Content', fields: [{ name: 'noIndex', type: 'checkbox', label: 'Hide from search engines' }] },
            // The SEO plugin with tabbedUI: an unnamed tab holding the `meta` group.
            { label: 'SEO', fields: [{ name: 'meta', type: 'group', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] }] },
          ],
        },
      ],
    },
    { slug: 'submissions', fields: [{ name: 'form', type: 'select', options: ['contact'] }] },
  ],
  globals: [{ slug: 'navigation', versions: { drafts: true }, fields: [] }],
})

test('addresses', () => {
  const routes = { pages: '/:slug', posts: '/blog/:slug' }
  assert.equal(publicPath(routes, 'home', 'pages', { slug: 'home' }), '/')
  assert.equal(publicPath(routes, 'home', 'pages', { slug: 'about' }), '/about')
  assert.equal(publicPath(routes, 'home', 'posts', { slug: 'hello' }), '/blog/hello')
  assert.equal(publicPath(routes, 'home', 'pages', { slug: 'x', path: '/services/x' }), '/services/x')
  assert.equal(publicPath(routes, 'home', 'media', { slug: 'x' }), null)
})

test('the plugin sets the admin and keeps what the project set', () => {
  const config = webheroAdmin({ livePreview: { collections: ['pages'] }, saveHelp: { pages: 'Drafts.' } })(base())
  assert.equal(config.admin.components.Nav, NAV_RAIL)
  assert.equal(config.admin.components.actions.at(-1), '/components/admin/Own#Own')
  // Language, account and header row: the guide is in the menu, not a second "?" top right.
  assert.equal(config.admin.components.actions.length, 4)
  assert.ok(config.admin.components.providers.includes('@webheroco/payload-admin/client#ListPanels'))
  assert.equal(config.i18n.translations.en.general.noResultsFound, 'Nothing to show.')
  // Performance is the home page: it replaces the dashboard rather than adding /performance.
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'dashboard', 'guide', 'claudeSetup', 'sections'])
  assert.equal(config.admin.custom.webheroAdmin.home, 'performance')
  assert.deepEqual(config.admin.custom.webheroAdmin.enquiries, { collection: 'submissions', formField: 'form', pageField: 'page' })
  assert.deepEqual(config.admin.custom.webheroAdmin.seo, [{ slug: 'pages', kind: 'Page' }])

  const pages = config.collections[0]
  assert.equal(pages.admin.hideAPIURL, true)
  assert.equal(pages.versions.maxPerDoc, 50)
  // Save help sits in the status "i" note, not at the top of the form.
  assert.ok(!pages.fields.some((f) => f.name === 'saveHelp'))
  assert.deepEqual(pages.admin.components.edit.Status.clientProps, { help: 'Drafts.' })
  assert.equal(pages.fields.find((f) => f.name === 'hidden').admin.components.Field, SWITCH_FIELD)
  assert.equal(pages.fields.find((f) => f.name === 'hidden').admin.components.Cell, '@webheroco/payload-admin/client#YesNoCell')
  const tabs = pages.fields.find((f) => f.type === 'tabs').tabs
  assert.equal(tabs[0].label, 'Content')
  assert.equal(tabs[1].label, 'SEO')
  // noIndex moves from Content into SEO, shown as "Indexed".
  assert.equal(tabs[0].fields.length, 0)
  assert.equal(tabs[1].fields[0].name, 'noIndex')
  assert.equal(tabs[1].fields[0].label, 'Indexed')
  assert.deepEqual(tabs[1].fields[0].admin.components.Field, { path: SWITCH_FIELD, clientProps: { invert: true } })
  assert.equal(tabs[1].fields[1].fields[0].maxDepth, 1)
  assert.ok(pages.admin.components.edit.beforeDocumentControls.includes(PREVIEW_TOOLBAR))
  assert.deepEqual(pages.admin.components.beforeListTable[0].clientProps, {
    routes: { pages: '/:slug', posts: '/blog/:slug' },
    homeSlug: 'home',
    media: false,
    drafts: true,
    collectionSlug: 'pages',
  })
  assert.equal(config.globals[0].versions.max, 50)
})

test('pages can be turned off, and the Form Builder is found', () => {
  const input = base()
  input.collections.push({ slug: 'form-submissions', fields: [] })
  const config = webheroAdmin({ views: { performance: false } })(input)
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'guide', 'claudeSetup', 'sections'])
  assert.deepEqual(config.admin.custom.webheroAdmin.enquiries, { formBuilder: true })
  assert.equal(config.admin.custom.webheroAdmin.home, 'dashboard')
})

test('a site can keep its dashboard, with Performance on its own page', () => {
  const config = webheroAdmin({ home: 'dashboard' })(base())
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'performance', 'guide', 'claudeSetup', 'sections'])
})

test('approvals are off unless asked for, and wrap everything with drafts when on', async () => {
  const off = webheroAdmin()(base())
  assert.ok(!off.collections.some((c) => c.slug === 'reviews'))
  assert.equal(off.admin.components.views.reviews, undefined)

  const on = webheroAdmin({ approvals: true })(base())
  const reviews = on.collections.find((c) => c.slug === 'reviews')
  assert.ok(reviews)
  assert.equal(reviews.endpoints[0].path, '/publish-due')
  assert.equal(on.admin.components.views.reviews.path, '/reviews')
  const pages = on.collections.find((c) => c.slug === 'pages')
  assert.equal(pages.admin.components.edit.PublishButton.path, '@webheroco/payload-admin/client#ReviewButton')
  // The review's state is a line beside the buttons, not a banner field.
  assert.ok(!pages.fields.some((f) => f.name === 'reviewBanner'))
  assert.equal(on.globals[0].admin.components.elements.PublishButton.clientProps.roleField, 'role')
  // Submissions has no drafts, so it publishes as before.
  assert.equal(on.collections.find((c) => c.slug === 'submissions').admin.components.edit?.PublishButton, undefined)

  // An editor's publish is refused; an approver's goes through.
  const guard = pages.hooks.beforeChange[0]
  const req = (role) => ({ user: { id: 1, role } })
  assert.throws(() => guard({ data: { _status: 'published' }, req: req('editor'), context: {} }), /Only an approver can publish/)
  assert.deepEqual(guard({ data: { _status: 'published' }, req: req('client-admin'), context: {} }), { _status: 'published' })
  assert.deepEqual(guard({ data: { _status: 'draft' }, req: req('editor'), context: {} }), { _status: 'draft' })
})

test('links, the website link and guide cards are kept as plain options', () => {
  const config = webheroAdmin({
    links: [{ label: 'Orders', href: 'https://shop.example/app/orders', icon: 'receipt', group: 'Shop' }],
    websiteLink: true,
    guideCards: [{ id: 'shop', title: 'Prices', steps: ['In the shop.'], after: 'edit' }],
  })(base())
  const stored = config.admin.custom.webheroAdmin
  assert.deepEqual(stored.links, [{ label: 'Orders', href: 'https://shop.example/app/orders', icon: 'receipt', group: 'Shop' }])
  assert.equal(stored.websiteLink, true)
  assert.equal(stored.guideCards[0].after, 'edit')
  // Plain data only: it sits on the config and goes to client components.
  assert.doesNotThrow(() => JSON.stringify(stored))
  const plain = webheroAdmin()(base()).admin.custom.webheroAdmin
  assert.deepEqual([plain.links, plain.websiteLink, plain.guideCards], [[], false, []])
})

test('save help without drafts gets its own note beside Save', () => {
  const config = webheroAdmin({ saveHelp: { pages: 'Drafts.', submissions: 'Saves live.', navigation: 'Menus.' } })(base())
  const [pages, submissions] = config.collections
  // With drafts the help stays in the status group, not beside Save.
  assert.ok(!(pages.admin.components.edit.beforeDocumentControls ?? []).some((c) => c.path?.endsWith('#SaveNote')))
  const note = submissions.admin.components.edit.beforeDocumentControls.find((c) => c.path?.endsWith('#SaveNote'))
  assert.deepEqual(note.clientProps, { help: 'Saves live.' })
  const nav = config.globals[0].admin.components.elements.beforeDocumentControls.find((c) => c.path?.endsWith('#SaveNote'))
  assert.deepEqual(nav.clientProps, { help: 'Menus.' })
})

test('upload lists offer what an editor recognises, not the file plumbing', () => {
  const input = base()
  input.collections.push({
    slug: 'media',
    upload: { imageSizes: [{ name: 'card', width: 600 }] },
    fields: [
      { name: 'alt', type: 'text' },
      { name: 'prefix', type: 'text' },
      { name: '_objectKey', type: 'text' },
    ],
  })
  const media = webheroAdmin()(input).collections.find((c) => c.slug === 'media')
  const by = (name) => media.fields.find((f) => f.name === name)
  assert.equal(by('alt').admin, undefined)
  for (const name of ['prefix', '_objectKey', 'url', 'thumbnailURL', 'mimeType', 'filesize', 'width', 'height', 'focalX', 'focalY', 'sizes']) {
    assert.equal(by(name).admin.disableListColumn, true, name)
    assert.equal(by(name).admin.disableListFilter, true, name)
  }
  const card = by('sizes').fields.find((f) => f.name === 'card')
  assert.deepEqual(card.fields.map((f) => f.name).sort(), ['filename', 'filesize', 'height', 'mimeType', 'url', 'width'])
  // Collections without uploads get nothing added.
  assert.equal(webheroAdmin()(base()).collections[0].fields.some((f) => f.name === 'url'), false)
})

test('a storage plugin\'s own url and sizes fields are quieted too, inside the groups', () => {
  const input = base()
  input.collections.push({
    slug: 'media',
    upload: { imageSizes: [{ name: 'thumbnail', width: 300 }] },
    fields: [
      { name: 'alt', type: 'text' },
      // What a cloud storage plugin adds before webheroAdmin() runs.
      { name: 'url', type: 'text', admin: { hidden: true } },
      { name: 'sizes', type: 'group', fields: [{ name: 'thumbnail', type: 'group', fields: [{ name: 'url', type: 'text' }] }] },
    ],
  })
  const media = webheroAdmin()(input).collections.find((c) => c.slug === 'media')
  const by = (name) => media.fields.filter((f) => f.name === name)
  assert.equal(by('url').length, 1)
  assert.equal(by('sizes').length, 1)
  assert.equal(by('url')[0].admin.hidden, true)
  assert.equal(by('url')[0].admin.disableListColumn, true)
  const thumb = by('sizes')[0].fields.find((f) => f.name === 'thumbnail')
  assert.equal(by('sizes')[0].admin.disableListFilter, true)
  assert.equal(thumb.admin.disableListColumn, true)
  assert.deepEqual(thumb.fields.map((f) => f.name).sort(), ['filename', 'filesize', 'height', 'mimeType', 'url', 'width'])
  for (const f of thumb.fields) assert.equal(f.admin.disableListColumn, true, f.name)
})

test('a list description is left to Payload, shown under the top row', () => {
  const input = base()
  input.collections[0].admin.description = 'Every page on the site.'
  const [pages] = webheroAdmin()(input).collections
  assert.equal(pages.admin.components.Description, undefined)
})

test('lists read only their columns, plus what the tiles and pills need', () => {
  const [pages, submissions] = webheroAdmin()(base()).collections
  assert.equal(pages.admin.enableListViewSelectAPI, true)
  assert.deepEqual(pages.forceSelect, { title: true, _status: true })
  assert.deepEqual(submissions.forceSelect, {})
  const input = base()
  input.collections[1].admin = { enableListViewSelectAPI: false }
  const off = webheroAdmin()(input).collections[1]
  assert.equal(off.admin.enableListViewSelectAPI, false)
  assert.equal(off.forceSelect, undefined)
})

test('Columns offers top-level fields only', () => {
  const input = base()
  input.collections[1].fields.push(
    { name: 'hero', type: 'group', fields: [{ name: 'sticky', type: 'checkbox' }] },
    { type: 'row', fields: [{ name: 'phone', type: 'text' }] },
    { name: 'layout', type: 'blocks', blocks: [] },
    { name: 'kept', type: 'array', fields: [{ name: 'x', type: 'text' }] },
  )
  input.collections[1].admin = { defaultColumns: ['form', 'kept'] }
  const sub = webheroAdmin()(input).collections[1]
  const by = (name) => sub.fields.find((f) => f.name === name)
  assert.equal(by('hero').fields[0].admin.disableListColumn, true)
  assert.equal(sub.fields.find((f) => f.type === 'row').fields[0].admin?.disableListColumn, undefined)
  assert.equal(by('layout').admin.disableListColumn, true)
  assert.equal(by('kept').admin?.disableListColumn, undefined)
  assert.equal(by('form').admin?.disableListColumn, undefined)
})

test('collections with pictures get List/Grid', () => {
  const input = base()
  input.collections.push({ slug: 'team', fields: [{ name: 'name', type: 'text' }, { name: 'photo', type: 'upload', relationTo: 'media' }] })
  input.collections.push({ slug: 'files', upload: true, fields: [] })
  const out = webheroAdmin()(input).collections
  const team = out.find((c) => c.slug === 'team').admin.components.beforeListTable
  assert.equal(team.length, 1)
  assert.deepEqual(team[0].clientProps.picture, ['photo'])
  assert.equal(out.find((c) => c.slug === 'files').admin.components.beforeListTable[0].clientProps.media, true)
  assert.equal(out.find((c) => c.slug === 'submissions').admin.components?.beforeListTable, undefined)
  assert.equal(out.find((c) => c.slug === 'pages').admin.components.beforeListTable.length, 1)
})

test('a site that still lists the old "?" top right gets it taken out', () => {
  const input = base()
  input.admin.components.actions.push('@webheroco/payload-admin/client#HelpButton')
  const actions = webheroAdmin()(input).admin.components.actions
  assert.ok(!actions.includes('@webheroco/payload-admin/client#HelpButton'))
})

test('the Claude page can be turned off', () => {
  const config = webheroAdmin({ views: { claude: false } })(base())
  assert.equal('claudeSetup' in config.admin.components.views, false)
})

test('duplicateCheck adds the fingerprint and the note to the upload collections named', async () => {
  const input = base()
  input.collections.push({ slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }] })
  const config = webheroAdmin({ duplicateCheck: ['media', 'pages'] })(input)
  const media = config.collections.find((c) => c.slug === 'media')
  assert.deepEqual(media.fields.slice(0, 3).map((f) => f.name), ['duplicateCheck', 'contentHash', 'alt'])
  assert.equal(media.fields[1].index, true)
  assert.equal(media.fields[1].admin.hidden, true)
  // Not an upload collection: unchanged.
  assert.equal(config.collections.find((c) => c.slug === 'pages').fields.some((f) => f.name === 'contentHash'), false)
  // A server-side upload gets its fingerprint on save.
  const hook = media.hooks.beforeChange.at(-1)
  const data = await hook({ data: {}, req: { file: { data: Buffer.from('abc') } } })
  assert.equal(data.contentHash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  // Off by default.
  const plain = webheroAdmin()(base())
  assert.equal(plain.collections.some((c) => c.fields.some((f) => f.name === 'contentHash')), false)
})
