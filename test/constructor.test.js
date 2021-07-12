/* eslint-env jest */
'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('new Muckraker()', () => {
  test('can create an instance of Muckraker', () => {
    const db = new Muckraker(getOptions({ skipScripts: true }))
    expect(db).toBeInstanceOf(Muckraker)
  })

  test('can create an instance of Muckraker while specifying a non-default scriptDir', () => {
    const db = new Muckraker(getOptions())
    expect(db).toBeInstanceOf(Muckraker)
  })

  test('correctly reports connection failures', () => {
    const db = new Muckraker(getOptions({ connectionFail: true }))
    expect(db.users.find()).rejects.toThrow('Failed to connect')
  })
})
