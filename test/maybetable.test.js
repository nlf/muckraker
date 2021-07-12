/* eslint-env jest */
'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('MaybeTable', () => {
  test('errors appropriately when a MaybeTable does not resolve to a real table', async () => {
    const db = new Muckraker(getOptions())
    expect.hasAssertions()
    try {
      await db.bananas.find()
    } catch (err) {
      expect(err.message).toEqual('Unknown table "bananas"')
    }
  })
})
