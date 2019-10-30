'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('#query()', () => {
  test('can send a raw query', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.query('SELECT * FROM "users"')
    expect(query).toEqual('SELECT * FROM "users"')
  })
})

describe('#find()', () => {
  test('defaults to returning all columns', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.find()
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users"`)
  })

  test('can return a subset of columns', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({}, ['id', 'user_name'])
    expect(query).toEqual('SELECT "id","user_name" FROM "users"')
  })

  test('ignores requested columns that do not exist', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({}, ['id', 'user_name', 'junk'])
    expect(query).toEqual('SELECT "id","user_name" FROM "users"')
  })

  test('can return a property from a json column', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({}, ['id', ['blob', 'some', 'path']])
    expect(query).toEqual(`SELECT "id","blob"#>>'{some,path}' AS "path" FROM "users"`)
  })

  test('ignores json properties on columns that are not json', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({}, ['id', ['blob', 'some', 'path'], ['user_name', 'junk']])
    expect(query).toEqual(`SELECT "id","blob"#>>'{some,path}' AS "path" FROM "users"`)
  })

  test('defaults to adding a NOT NULL clause on "deleted_at" when column exists', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.entries.find()
    expect(query).toEqual(`SELECT ${db.entries._builder.getColumnNames()} FROM "entries" WHERE "deleted_at" IS NULL`)
  })

  test('can override the "deleted_at" column name globally', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { timestamps: { deleted: 'deleted' } }))
    const query = await db.articles.find()
    expect(query).toEqual(`SELECT ${db.articles._builder.getColumnNames()} FROM "articles" WHERE "deleted" IS NULL`)
  })

  test('can override the "deleted_at" column name per table', async () => {
    const db = new Muckraker(Object.assign({}, getOptions(), { timestamps: { deleted: 'really_deleted', articles: { deleted: 'deleted' } } }))
    const query = await db.articles.find()
    expect(query).toEqual(`SELECT ${db.articles._builder.getColumnNames()} FROM "articles" WHERE "deleted" IS NULL`)
  })

  test('allows ignoring default NOT NULL clause on "deleted_at"', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.entries.find({ deleted_at: { $ne: null } })
    expect(query).toEqual(`SELECT ${db.entries._builder.getColumnNames()} FROM "entries" WHERE "deleted_at" IS NOT NULL`)
  })

  test('allows overriding the default filter for tables with a deleted_at column by passing a date', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.entries.find({ deleted_at: new Date() })
    const matcher = new RegExp(`SELECT ${db.entries._builder.getColumnNames()} FROM "entries" WHERE "deleted_at" = '[^']+'`)
    expect(query).toMatch(matcher)
  })

  test('can compare a column to a json object', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ id: { some: 'thing' } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "id" = '{"some":"thing"}'`)
  })

  test('can find rows in a table with a condition', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ id: 0, invalid: 'key' })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "id" = 0`)
  })

  test('can find rows in a table with a condition in a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { test: 'object' } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{test}' = 'object'`)
  })

  test('can find rows in a table with a column that is null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ unknown: null })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "unknown" IS NULL`)
  })

  test('can find rows in a table with a json value that is null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: null } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`)
  })

  test('can find rows in a table with a column that is explicitly null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ unknown: { $eq: null } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "unknown" IS NULL`)
  })

  test('can find rows in a table with a json value that is explicitly null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { $eq: null } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`)
  })

  test('can find rows in a table with a column that is not null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ unknown: { $ne: null } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "unknown" IS NOT NULL`)
  })

  test('can find rows in a table with a json value that is not null', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { $ne: null } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some}' IS NOT NULL`)
  })

  test('can use the $gt operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $gt: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" > 1`)
  })

  test('can use the $gt operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $gt: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' > 5`)
  })

  test('can use the $gte operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $gte: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" >= 1`)
  })

  test('can use the $gte operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $gte: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' >= 5`)
  })

  test('can use the $lt operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $lt: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" < 1`)
  })

  test('can use the $lt operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $lt: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' < 5`)
  })

  test('can use the $lte operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $lte: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" <= 1`)
  })

  test('can use the $lte operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $lte: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' <= 5`)
  })

  test('can use the $ne operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $ne: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" != 1`)
  })

  test('can use the $ne operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $ne: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' != 5`)
  })

  test('can use the $eq operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $eq: 1 } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" = 1`)
  })

  test('can use the $eq operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $eq: 5 } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' = 5`)
  })

  test('can use the $in operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $in: [1, 2, 3] } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" IN (1,2,3)`)
  })

  test('can use the $in operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $in: [1, 2, 3] } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' IN (1,2,3)`)
  })

  test('can use the $nin operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ pets: { $nin: [1, 3] } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "pets" NOT IN (1,3)`)
  })

  test('can use the $nin operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $nin: [1, 2, 3] } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' NOT IN (1,2,3)`)
  })

  test('can use the $like operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ user_name: { $like: 'test' } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "user_name" LIKE 'test'`)
  })

  test('can use the $like operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $like: 'test' } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' LIKE 'test'`)
  })

  test('can use the $nlike operator', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ user_name: { $nlike: 'test' } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "user_name" NOT LIKE 'test'`)
  })

  test('can use the $nlike operator on a json column', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.find({ blob: { some: { value: { $nlike: 'test' } } } })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "blob"#>>'{some,value}' NOT LIKE 'test'`)
  })
})

describe('#findOne()', () => {
  test('can find a single row', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.findOne()
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users"`)
  })

  test('can find a single row with a condition', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.findOne({ id: 0 })
    expect(query).toEqual(`SELECT ${db.users._builder.getColumnNames()} FROM "users" WHERE "id" = 0`)
  })
})
