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
  assert.equal(config.admin.components.actions.length, 5)
  // Performance is the home page: it replaces the dashboard rather than adding /performance.
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'dashboard', 'guide', 'sections'])
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
    collectionSlug: 'pages',
  })
  assert.equal(config.globals[0].versions.max, 50)
})

test('pages can be turned off, and the Form Builder is found', () => {
  const input = base()
  input.collections.push({ slug: 'form-submissions', fields: [] })
  const config = webheroAdmin({ views: { performance: false } })(input)
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'guide', 'sections'])
  assert.deepEqual(config.admin.custom.webheroAdmin.enquiries, { formBuilder: true })
  assert.equal(config.admin.custom.webheroAdmin.home, 'dashboard')
})

test('a site can keep its dashboard, with Performance on its own page', () => {
  const config = webheroAdmin({ home: 'dashboard' })(base())
  assert.deepEqual(Object.keys(config.admin.components.views), ['seoOverview', 'performance', 'guide', 'sections'])
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
