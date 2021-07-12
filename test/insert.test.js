/* eslint-env jest */
'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('#insert()', () => {
  test('can insert a row', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.insert({ id: 0, invalid: 'key', user_name: 'test', blob: { some: 'data' } })
    expect(query).toEqual(`INSERT INTO "users" ("id","user_name","blob") VALUES (0,'test','{"some":"data"}') RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can insert a row with an empty array cast to the correct type', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.insert({ id: 0, user_name: 'test', pet_names: [] })
    expect(query).toEqual(`INSERT INTO "users" ("id","user_name","pet_names") VALUES (0,'test','{}'::text[]) RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can insert a row with a populated array cast to the correct type', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.insert({ id: 0, user_name: 'test', pet_names: ['fluffy', 'spike'] })
    expect(query).toEqual(`INSERT INTO "users" ("id","user_name","pet_names") VALUES (0,'test',array['fluffy','spike']::text[]) RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can set created_at and updated_at implicitly when creating a row', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\('test','[^']+','[^']+'\\) RETURNING ${db.entries._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })

  test('can override created_at and updated_at column names', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { timestamps: { created: 'created', updated: 'updated' } }))
    const query = await db.articles.insert({ id: 10 })
    const matcher = new RegExp(`INSERT INTO "articles" \\("id","created","updated"\\) VALUES \\(10,'[^']+','[^']+'\\) RETURNING ${db.articles._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })

  test('can set an encrypted value and not return it by default', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { encrypt: { 'entries.value': { key: 'somekey' } } }))
    const query = await db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })

  test('can set an encrypted value and return it', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { encrypt: { 'entries.value': { key: 'somekey' } } }))
    const query = await db.entries.insert({ value: 'test' }, ['created_at', 'updated_at', 'deleted_at', 'id', 'value'])
    const formattedColumns = db.entries._builder.getColumnNames(Object.keys(db.entries._columns)).map((column) => {
      if (column.startsWith('pgp_sym')) {
        column = column.replace('(', '\\(').replace(')', '\\)')
      }

      return column
    })

    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${formattedColumns}`)
    expect(query).toMatch(matcher)
  })

  test('can set an encrypted value with a non-default (global) cipher', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { encrypt: { 'entries.value': { key: 'somekey' }, cipher: 'aes192' } }))
    const query = await db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes192'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })

  test('can set an encrypted value with a non-default cipher', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { encrypt: { 'entries.value': { key: 'somekey', cipher: 'aes512' }, cipher: 'aes192' } }))
    const query = await db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes512'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })
})
