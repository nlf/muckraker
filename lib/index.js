'use strict'

const Database = require('./database')
const MaybeTable = require('./maybetable')

class Muckraker extends Database {
  constructor (options) {
    super(options)
    return new Proxy(this, {
      get (target, prop) {
        if (!Reflect.has(target, prop) && typeof prop === 'string') {
          return new MaybeTable(target, prop)
        }
        return Reflect.get(target, prop)
      }
    })
  }
}

module.exports = Muckraker
