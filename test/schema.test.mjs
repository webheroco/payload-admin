import assert from 'node:assert/strict'
import test from 'node:test'

import { checkHtml, worst } from '../dist/schema-rules.js'

const page = (...nodes) => nodes.map((n) => `<script type="application/ld+json">${typeof n === 'string' ? n : JSON.stringify(n)}</script>`).join('')

test('reads @graph, checks required and recommended properties', () => {
  const checks = checkHtml(
    page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Acme', url: 'https://acme.test', logo: 'https://acme.test/logo.png' },
        { '@type': 'WebPage', name: 'Home' },
        { '@type': 'BlogPosting', headline: 'Hello' },
      ],
    }),
  )
  assert.deepEqual(checks.map((c) => [c.type, c.verdict]), [['Organization', 'good'], ['BlogPosting', 'warn']])
  assert.ok(checks[1].issues.includes('No datePublished (recommended)'))
})

test('FAQ questions need an answer; broken JSON is an error; unknown types have no verdict', () => {
  const checks = checkHtml(
    page(
      { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Why?', acceptedAnswer: { '@type': 'Answer', text: '' } }] },
      '{ not json',
      { '@type': 'TrainingCourseThing', name: 'x' },
    ),
  )
  assert.deepEqual(checks.map((c) => c.verdict), ['error', 'error', 'none'])
  assert.equal(checks[0].issues[0], 'Question 1 has no acceptedAnswer text')
  assert.equal(worst(checks.map((c) => c.verdict)), 'error')
})

test('a local business needs an address; breadcrumbs need positions', () => {
  const checks = checkHtml(
    page({ '@type': 'Plumber', name: 'Pipes' }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', name: 'Home', item: '/' }] }),
  )
  assert.deepEqual(checks.map((c) => c.verdict), ['error', 'error'])
  assert.ok(checks[0].issues.includes('Missing address'))
  assert.ok(checks[1].issues.includes('Breadcrumb 1 has no position'))
})
