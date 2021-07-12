/* eslint-env jest */
'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('transactions', () => {
  test('txMode exists', async () => {
    const db = new Muckraker(getOptions())
    expect(db.txMode).toEqual(expect.anything())
  })

  test('can run a transaction', async () => {
    const db = new Muckraker(getOptions())
    return db.tx(async (d) => {
      expect(d._db._txopts).toEqual({})
      const query = await d.query('SELECT * FROM "users"')
      expect(query).toEqual('SELECT * FROM "users"')
    })
  })

  test('can run a transaction with options', async () => {
    const db = new Muckraker(getOptions())
    const opts = { test: true }
    return db.tx(opts, async (d) => {
      expect(d._db._txopts).toEqual(opts)
      const query = await d.query('SELECT * FROM "users"')
      expect(query).toEqual('SELECT * FROM "users"')
    })
  })
})

describe('tasks', () => {
  test('can run a tagged task', async () => {
    const db = new Muckraker(getOptions())
    return db.task('some-tag', async (d) => {
      expect(d._db._tag).toEqual('some-tag')
      const query = await d.query('SELECT * FROM "users"')
      expect(query).toEqual('SELECT * FROM "users"')
    })
  })

  test('can run a task without a tag', async () => {
    const db = new Muckraker(getOptions())
    return db.task(async (d) => {
      expect(d._db._tag).toEqual(undefined)
      const query = await d.query('SELECT * FROM "users"')
      expect(query).toEqual('SELECT * FROM "users"')
    })
  })
})
