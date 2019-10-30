'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('#update()', () => {
  test('can update a row', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.update({ id: 0, invalid: 'key', blob: { some: 'thing' } }, { user_name: 'test_user', invalid: 'key', blob: { another: 'thing' } })
    expect(query).toEqual(`UPDATE "users" SET "user_name" = 'test_user', "blob" = '{"another":"thing"}' WHERE "id" = 0 AND "blob"#>>'{some}' = 'thing' RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can update a row without a query', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.update(null, { user_name: 'test_user' })
    expect(query).toEqual(`UPDATE "users" SET "user_name" = 'test_user' RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can set the updated_at column implicitly if it exists', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.entries.update({ value: 'test' }, { value: 'different test' })
    const matcher = new RegExp(`UPDATE "entries" SET "value" = 'different test', "updated_at" = '[^']+' WHERE "value" = 'test' AND "deleted_at" IS NULL RETURNING ${db.entries._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })

  test('can use a different updated_at column', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { timestamps: { updated: 'updated', deleted: 'deleted' } }))
    const query = await db.articles.update({ id: 5 }, { id: 1 })
    const matcher = new RegExp(`UPDATE "articles" SET "id" = 1, "updated" = '[^']+' WHERE "id" = 5 AND "deleted" IS NULL RETURNING ${db.articles._builder.getColumnNames()}`)
    expect(query).toMatch(matcher)
  })
})

describe('#updateOne()', () => {
  test('can update a row', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.updateOne({ id: 0 }, { user_name: 'test_user' })
    expect(query).toEqual(`UPDATE "users" SET "user_name" = 'test_user' WHERE "id" = 0 RETURNING ${db.users._builder.getColumnNames()}`)
  })

  test('can update a row without a query', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.updateOne(null, { user_name: 'test_user' })
    expect(query).toEqual(`UPDATE "users" SET "user_name" = 'test_user' RETURNING ${db.users._builder.getColumnNames()}`)
  })
})
