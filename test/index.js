'use strict'

const Muckraker = require('../')

const Mock = require('./mock')
const Path = require('path')

const { test } = require('tap')

const internals = {
  connection: {
    host: 'localhost'
  },
  _mocked: new Mock()
}

test('constructor', async () => {
  test('can create an instance of Muckraker', async (t) => {
    const db = new Muckraker(internals)
    t.ok(db)
    t.ok(db instanceof Muckraker)
  })

  test('can create an instance of Muckraker while specifying a different scriptDir', async (t) => {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    t.ok(db)
    t.ok(db instanceof Muckraker)
  })

  test('correctly throws an error when connection fails', async (t) => {
    t.throws(() => {
      new Muckraker({ _mocked: new Mock(true) })
    }, 'Failed to connect')
  })
})

test('query', async () => {
  test('can send a raw query', async (t) => {
    const db = new Muckraker(internals)
    const query = db.query('SELECT * FROM "users"')
    t.equal(query, 'SELECT * FROM "users"')
  })
})

test('find', async () =>  {
  test('can find rows in a table', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find()
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users"`)
  })

  test('can return a subset of columns', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({}, ['id', 'user_name', 'junk'])
    t.equal(query, 'SELECT "id","user_name" FROM "users"')
  })

  test('can return a property of a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({}, ['id', ['blob', 'some', 'path']])
    t.equal(query, 'SELECT "id","blob"#>>\'{some,path}\' AS "path" FROM "users"')
  })

  test('ignores invalid json properties', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({}, [['id', 'invalid', 'path'], 'user_name', ['invalid', 'path'], ['json_blob', 'real', 'path']])
    t.equal(query, 'SELECT "user_name","json_blob"#>>\'{real,path}\' AS "path" FROM "users"')
  })

  test('adds a filter for tables with a deleted_at column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.find()
    t.equal(query, `SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" IS NULL`)
  })

  test('allows overriding the default filter for tables with a deleted_at column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.find({ deleted_at: { $ne: null } })
    t.equal(query, `SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" IS NOT NULL`)
  })

  test('allows overriding the default filter for tables with a deleted_at column by passing a date', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.find({ deleted_at: new Date() })
    const matcher = new RegExp(`SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" = '[^']+'`)
    t.match(query, matcher)
  })

  test('can compare a column to a json object', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ id: { some: 'thing' } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = '{"some":"thing"}'`)
  })

  test('can find rows in a table with a condition', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ id: 0, invalid: 'key' })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = 0`)
  })

  test('can find rows in a table with a condition in a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { test: 'object' } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{test}' = 'object'`)
  })

  test('can find rows in a table with a column that is null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ unknown: null })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NULL`)
  })

  test('can find rows in a table with a json value that is null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: null } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`)
  })

  test('can find rows in a table with a column that is explicitly null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ unknown: { $eq: null } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NULL`)
  })

  test('can find rows in a table with a json value that is explicitly null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { $eq: null } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`)
  })

  test('can find rows in a table with a column that is not null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ unknown: { $ne: null } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NOT NULL`)
  })

  test('can find rows in a table with a json value that is not null', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { $ne: null } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NOT NULL`)
  })

  test('can use the $gt operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $gt: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" > 1`)
  })

  test('can use the $gt operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $gt: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' > 5`)
  })

  test('can use the $gte operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $gte: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" >= 1`)
  })

  test('can use the $gte operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $gte: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' >= 5`)
  })

  test('can use the $lt operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $lt: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" < 1`)
  })

  test('can use the $lt operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $lt: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' < 5`)
  })

  test('can use the $lte operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $lte: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" <= 1`)
  })

  test('can use the $lte operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $lte: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' <= 5`)
  })

  test('can use the $ne operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $ne: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" != 1`)
  })

  test('can use the $ne operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $ne: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' != 5`)
  })

  test('can use the $eq operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $eq: 1 } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" = 1`)
  })

  test('can use the $eq operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $eq: 5 } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' = 5`)
  })

  test('can use the $in operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $in: [1, 2, 3] } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" IN (1,2,3)`)
  })

  test('can use the $in operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $in: [1, 2, 3] } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' IN (1,2,3)`)
  })

  test('can use the $nin operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ pets: { $nin: [1, 3] } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" NOT IN (1,3)`)
  })

  test('can use the $nin operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $nin: [1, 2, 3] } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' NOT IN (1,2,3)`)
  })

  test('can use the $like operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ user_name: { $like: 'test' } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "user_name" LIKE 'test'`)
  })

  test('can use the $like operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $like: 'test' } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' LIKE 'test'`)
  })

  test('can use the $nlike operator', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ user_name: { $nlike: 'test' } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "user_name" NOT LIKE 'test'`)
  })

  test('can use the $nlike operator on a json column', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.find({ blob: { some: { value: { $nlike: 'test' } } } })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' NOT LIKE 'test'`)
  })
})

test('findOne', async () =>  {
  test('can find a single row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.findOne()
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users"`)
  })

  test('can find a single row with a condition', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.findOne({ id: 0 })
    t.equal(query, `SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = 0`)
  })
})

test('insert', async () =>  {
  test('can insert a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.insert({ id: 0, invalid: 'key', user_name: 'test', blob: { some: 'data' } })
    t.equal(query, `INSERT INTO "users" ("id","user_name","blob") VALUES (0,'test','{"some":"data"}') RETURNING ${db.users._formatColumns()}`)
  })

  test('can insert a row with an empty array cast to the correct type', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.insert({ id: 0, user_name: 'test', pet_names: [] })
    t.equal(query, `INSERT INTO "users" ("id","user_name","pet_names") VALUES (0,'test','{}'::text[]) RETURNING ${db.users._formatColumns()}`)
  })

  test('can insert a row with a populated array cast to the correct type', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.insert({ id: 0, user_name: 'test', pet_names: ['fluffy', 'spike'] })
    t.equal(query, `INSERT INTO "users" ("id","user_name","pet_names") VALUES (0,'test',array['fluffy','spike']::text[]) RETURNING ${db.users._formatColumns()}`)
  })

  test('can set created_at and updated_at implicitly when creating a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\('test','[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`)
    t.match(query, matcher)
  })

  test('can set an encrypted value and not return it by default', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' } }))
    const query = db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`)
    t.match(query, matcher)
  })

  test('can set an encrypted value and return it', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' } }))
    const query = db.entries.insert({ value: 'test' }, Object.keys(db.entries._columns))
    const formattedColumns = db.entries._formatColumns(Object.keys(db.entries._columns)).map((column) => {
      if (column.startsWith('pgp_sym')) {
        column = column.replace('(', '\\(').replace(')', '\\)')
      }

      return column
    })

    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${formattedColumns}`)
    t.match(query, matcher)
  })

  test('can set an encrypted value with a non-default cipher', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' }, cipher: 'aes192' }))
    const query = db.entries.insert({ value: 'test' })
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes192'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`)
    t.match(query, matcher)
  })
})

test('destroy', async () =>  {
  test('can delete a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.destroy()
    t.equal(query, 'DELETE FROM "users"')
  })

  test('can delete a row with a condition', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.destroy({ id: 0 })
    t.equal(query, 'DELETE FROM "users" WHERE "id" = 0')
  })

  test('can soft delete a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.destroy({ id: 0 })
    t.match(query, /^UPDATE "entries" SET "deleted_at" = '([^)]+)' WHERE "id" = 0$/)
  })
})

test('update', async () =>  {
  test('can update a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.update({ id: 0, invalid: 'key', blob: { some: 'thing' } }, { user_name: 'test_user', invalid: 'key', blob: { another: 'thing' } })
    t.equal(query, `UPDATE "users" SET "user_name" = 'test_user', "blob" = '{"another":"thing"}' WHERE "id" = 0 AND "blob"#>>'{some}' = 'thing' RETURNING ${db.users._formatColumns()}`)
  })

  test('can update a row without a query', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.update(null, { user_name: 'test_user' })
    t.equal(query, `UPDATE "users" SET "user_name" = 'test_user' RETURNING ${db.users._formatColumns()}`)
  })

  test('can set the updated_at column implicitly if it exists', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.entries.update({ value: 'test' }, { value: 'different test' })
    const matcher = new RegExp(`UPDATE "entries" SET "value" = 'different test', "updated_at" = '[^']+' WHERE "value" = 'test' AND "deleted_at" IS NULL RETURNING ${db.entries._formatColumns()}`)
    t.match(query, matcher)
  })
})

test('updateOne', async () =>  {
  test('can update a row', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.updateOne({ id: 0 }, { user_name: 'test_user' })
    t.equal(query, `UPDATE "users" SET "user_name" = 'test_user' WHERE "id" = 0 RETURNING ${db.users._formatColumns()}`)
  })

  test('can update a row without a query', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.updateOne(null, { user_name: 'test_user' })
    t.equal(query, `UPDATE "users" SET "user_name" = 'test_user' RETURNING ${db.users._formatColumns()}`)
  })
})

test('scripts', async () =>  {
  test('can run a script', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    const query = db.another_thing()
    t.equal(query, 'SELECT * FROM "users"')
  })

  test('can run a script that returns a single result', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    const query = db.row()
    t.equal(query, 'SELECT * FROM "users"')
  })

  test('can run a namespaced script', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    const query = db.users.random()
    t.equal(query, 'SELECT * FROM "users"')
  })

  test('can run a namespaced script when the table has underscores', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    const query = db.with_underscores.row()
    t.equal(query, 'SELECT * FROM "users"')
  })

  test('can run a namespaced script that returns a single result', async (t) =>  {
    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }))
    const query = db.users.leader()
    t.equal(query, 'SELECT * FROM "users"')
  })
})

test('routines', async () =>  {
  test('can run a routine', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.something_random()
    t.equal(query.q, 'something_random')
  })

  test('can run a scoped routine', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.self()
    t.equal(query.q, 'users_self')
  })

  test('can run a scoped routine that returns a single result', async (t) =>  {
    const db = new Muckraker(internals)
    const query = db.users.person()
    t.equal(query.q, 'users_one_person')
  })
})

test('transactions', async () =>  {
  test('txMode exists', async (t) =>  {
    const db = new Muckraker(internals)
    t.ok(db.txMode)
  })

  test('can run a transaction', async (t) =>  {
    const db = new Muckraker(internals)
    return db.tx((d) => {
      t.same(d._db._txopts, {})
      const query = d.query('SELECT * FROM "users"')
      t.equal(query, 'SELECT * FROM "users"')
    })
  })

  test('can run a transaction with options', async (t) =>  {
    const db = new Muckraker(internals)
    const opts = { test: true }
    return db.tx(opts, (d) => {
      t.same(d._db._txopts, opts)
      const query = d.query('SELECT * FROM "users"')
      t.equal(query, 'SELECT * FROM "users"')
    })
  })
})
