/* eslint-env jest */
'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('#destroy()', () => {
  test('can delete a row', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.destroy()
    expect(query).toEqual('DELETE FROM "users"')
  })

  test('can delete a row with a condition', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.destroy({ id: 0 })
    expect(query).toEqual('DELETE FROM "users" WHERE "id" = 0')
  })

  test('can soft delete a row', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.entries.destroy({ id: 0 })
    expect(query).toMatch(/^UPDATE "entries" SET "deleted_at" = '([^)]+)' WHERE "id" = 0$/)
  })
})
