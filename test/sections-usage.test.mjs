// Runs against the built package (npm run build first).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { blockTables, sectionUsage, usagePlan, usageSql } from '../dist/sections-usage.js'

const relations = {
  tenant: { type: 'one', to: 'tenants' },
  _blocks_text: { type: 'many', to: '_pages_v_blocks_text' },
  _blocks_hero: { type: 'many', to: '_pages_hr_tp_v' },
}

test('block tables come from the adapter relations, by slug', () => {
  const t = blockTables(relations, ['text', 'hero'])
  assert.deepEqual([...t], [['text', '_pages_v_blocks_text'], ['hero', '_pages_hr_tp_v']])
})

test('the SQL is one union over the block tables, for the given documents only', () => {
  const sql = usageSql(new Map([['text', '_pages_v_blocks_text'], ["o'dd", 'we"ird']]), [1, "2'"], { table: '_pages_v', versions: true })
  assert.ok(sql.startsWith(`with o as (select id, parent_id as doc from "_pages_v" where latest = true and parent_id in ('1', '2'''))`))
  assert.ok(sql.includes(`select 'text' as slug, _parent_id from "_pages_v_blocks_text" where _parent_id in (select id from o)`))
  assert.ok(sql.includes(`select 'o''dd' as slug, _parent_id from "we""ird"`))
  assert.ok(sql.endsWith('join o on o.id = b._parent_id'))
  // The id list is written once, however many kinds of section.
  assert.equal(sql.split(`'2'''`).length, 2)
  assert.ok(usageSql(new Map([['text', 'pages_blocks_text']]), [7], { table: 'pages' }).includes(`select id, id as doc from "pages" where id in ('7')`))
  // No documents (another site's screen, or no access): nothing is read.
  assert.equal(usageSql(new Map([['text', 'pages_blocks_text']]), [], { table: 'pages' }), null)
})

test('usage groups section slugs by document, and steps aside where it cannot answer', async () => {
  let asked = ''
  const db = {
    pool: { query: async (text) => { asked = text; return { rows: [{ slug: 'text', id: 1 }, { slug: 'hero', id: 1 }, { slug: 'text', id: 2 }] } } },
    rawRelations: { _pages_v: relations },
    tableNameMap: new Map([['pages', 'pages'], ['_pages_v', '_pages_v']]),
  }
  const plan = usagePlan(db, 'pages', ['text', 'hero'], true)
  const usage = await sectionUsage(plan, [1, 2])
  assert.deepEqual([...usage.get('1')].sort(), ['hero', 'text'])
  assert.deepEqual([...usage.get('2')], ['text'])
  assert.match(asked, /"_pages_v"/)
  // A kind of section with no table it can find: Payload is asked instead.
  assert.equal(usagePlan(db, 'pages', ['text', 'missing'], true), null)
  // Not Postgres.
  assert.equal(usagePlan({}, 'pages', ['text'], true), null)
  // No documents: no query.
  asked = ''
  assert.equal((await sectionUsage(plan, [])).size, 0)
  assert.equal(asked, '')
})
