import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pictureOf, pictureQuery, picturesFrom } from '../dist/grid-pictures.js'

const paths = ['gallery.image', 'meta.image']

test('a list whose query holds only the visible columns: the tiles ask for the picture fields', () => {
  // What the list query gives on such a site: ids and visible columns, no gallery or meta.
  const listDocs = [{ id: 7, title: 'Scanner' }, { id: 9, title: 'Printer' }]
  assert.equal(pictureOf(listDocs[0], paths), null)

  const query = new URLSearchParams(pictureQuery('pages', listDocs.map((d) => String(d.id)), paths).split('?')[1])
  assert.equal(query.get('where[id][in]'), '7,9')
  assert.equal(query.get('select[gallery]'), 'true')
  assert.equal(query.get('select[meta]'), 'true')
  assert.equal(query.get('depth'), '1')
  // The list shows the latest draft, so the picture must come from it too.
  assert.equal(query.get('draft'), 'true')
  assert.equal(query.get('limit'), '2')

  // That request's answer: the pictures, populated.
  const answer = [
    { id: 7, gallery: [{ image: null }, { image: { id: 'a', url: '/a.jpg' } }] },
    { id: 9, gallery: [], meta: { image: { id: 'b', url: '/b.jpg' } } },
  ]
  const pictures = picturesFrom(answer, paths)
  assert.equal(pictures['7'].url, '/a.jpg')
  assert.equal(pictures['9'].url, '/b.jpg')
})

test('a page with no picture has none, so its tile shows its letter', () => {
  assert.deepEqual(picturesFrom([{ id: 3, gallery: [], meta: {} }], paths), {})
})
