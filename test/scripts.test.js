'use strict'

const Muckraker = require('../')
const { getOptions } = require('./common')

describe('scripts', () => {
  test('can run a script', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.another_thing()
    expect(query).toEqual('SELECT * FROM "users"')
  })

  test('can run a script defined via javascript', async () => {
    const db = new Muckraker(getOptions())
    const query = await db.users.feed()
    expect(query).toEqual('SELECT "id","user_name","blob","json_blob","created","pets","pet_names","unknown" FROM "users"')
  })

  test('can run a script that returns a single result', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.row()
    expect(query).toEqual('SELECT * FROM "users"')
  })

  test('can run a namespaced script', async () =>  {
    const db = new Muckraker(getOptions())
    await new Promise(resolve => setImmediate(resolve))
    const query = await db.users.random()
    expect(query).toEqual('SELECT * FROM "users"')
  })

  test('can run a namespaced script when the table has underscores', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.with_underscores.row()
    expect(query).toEqual('SELECT * FROM "users"')
  })

  test('can run a namespaced script that returns a single result', async () =>  {
    const db = new Muckraker(getOptions())
    const query = await db.users.leader()
    expect(query).toEqual('SELECT * FROM "users"')
  })

  test('ignores when scriptDir does not exist or is not a directory', async () => {
    expect(() => new Muckraker(Object.assign({}, getOptions(), { scriptDir: __filename }))).not.toThrow()
    expect(() => new Muckraker(Object.assign({}, getOptions(), { scriptDir: '/some/file/that/definitely/does/not/exist' }))).not.toThrow()
  })

  test('properly loads simple transactions in scripts', async () => {
    const db = new Muckraker(getOptions())
    const spy = jest.spyOn(db._db, 'tx')
    const query = await db.users.simpleTransaction()
    expect(spy).toHaveBeenCalled()
    const { tag } = spy.mock.calls[0][0]
    expect(tag).toEqual('simpleTransaction')
    spy.mockRestore()
  })

  test('properly loads complex transactions in scripts', async () => {
    const db = new Muckraker(getOptions())
    const spy = jest.spyOn(db._db, 'tx')
    const query = await db.users.complexTransaction()
    expect(spy).toHaveBeenCalled()
    const { tag } = spy.mock.calls[0][0]
    expect(tag).toEqual('something-complex')
    spy.mockRestore()
  })
})
