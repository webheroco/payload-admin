// Runs against the built package (npm run build first).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { blockTables, sectionUsage, usageSql } from '../dist/sections-usage.js'

const relations = {
  tenant: { type: 'one', to: 'tenants' },
  _blocks_text: { type: 'many', to: '_pages_v_blocks_text' },
  _blocks_hero: { type: 'many', to: '_pages_hr_tp_v' },
}

test('block tables come from the adapter relations, by slug', () => {
  const t = blockTables(relations, ['text', 'hero'])
  assert.deepEqual([...t], [['text', '_pages_v_blocks_text'], ['hero', '_pages_hr_tp_v']])
})

test('the SQL is one union over the block tables, joined to the latest versions', () => {
  const sql = usageSql(new Map([['text', '_pages_v_blocks_text'], ["o'dd", 'we"ird']]), '_pages_v')
  assert.match(sql, /select 'text' as slug, _parent_id from "_pages_v_blocks_text"/)
  assert.match(sql, /select 'o''dd' as slug, _parent_id from "we""ird"/)
  assert.match(sql, /join "_pages_v" v on v.id = b._parent_id where v.latest = true/)
  assert.match(usageSql(new Map([['text', 'pages_blocks_text']])), /b._parent_id as id/)
})

test('usage groups section slugs by document, and steps aside where it cannot answer', async () => {
  let asked = ''
  const db = {
    pool: { query: async (text) => { asked = text; return { rows: [{ slug: 'text', id: 1 }, { slug: 'hero', id: 1 }, { slug: 'text', id: 2 }] } } },
    rawRelations: { _pages_v: relations },
    tableNameMap: new Map([['pages', 'pages'], ['_pages_v', '_pages_v']]),
  }
  const usage = await sectionUsage(db, 'pages', ['text', 'hero'], true)
  assert.deepEqual([...usage.get('1')].sort(), ['hero', 'text'])
  assert.deepEqual([...usage.get('2')], ['text'])
  assert.match(asked, /"_pages_v"/)
  // A kind of section with no table it can find: Payload is asked instead.
  assert.equal(await sectionUsage(db, 'pages', ['text', 'missing'], true), null)
  // Not Postgres.
  assert.equal(await sectionUsage({}, 'pages', ['text'], true), null)
})
