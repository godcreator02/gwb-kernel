import test from 'node:test'
import assert from 'node:assert/strict'
import { decideSeed, pickTemplate } from '../app-template/lib/seed-core.mjs'

const nowhere = { exists: () => false }

test('只有「没点名 home 且 default 缺失」才种', () => {
  assert.equal(decideSeed({ homeArg: undefined, defaultHome: 'D', exists: nowhere.exists }), 'D')
  assert.equal(decideSeed({ homeArg: 'x', defaultHome: 'D', exists: nowhere.exists }), undefined)
  assert.equal(decideSeed({ homeArg: 'D:\\tmp', defaultHome: 'D', exists: nowhere.exists }), undefined)
  assert.equal(decideSeed({ homeArg: '', defaultHome: 'D', exists: nowhere.exists }), undefined)
})

test('default 已存在（装机人自己的台）不种', () => {
  assert.equal(decideSeed({ homeArg: undefined, defaultHome: 'D', exists: () => true }), undefined)
})

test('模板取第一个存在的候选，都没有就 undefined', () => {
  assert.equal(pickTemplate(['a', 'b'], (p) => p === 'b'), 'b')
  assert.equal(pickTemplate(['a', 'b'], () => false), undefined)
})
