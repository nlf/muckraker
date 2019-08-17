'use strict'

const Table = require('./table')

class MaybeTable {
  constructor (db, name) {
    this.db = db
    this.name = name
    for (const key in this.db._scripts[this.name]) {
      const script = this.db._scripts[this.name][key]
      this[script.name] = (args) => this._realTable(script.name, args)
    }
  }

  async _realTable (method, args) {
    await this.db._ready
    if (!this.db.hasOwnProperty(this.name)) {
      throw new Error(`Unknown table "${this.name}"`)
    }

    return this.db[this.name][method].apply(this.db[this.name], args)
  }

  find (...args) {
    return this._realTable('find', args)
  }

  findOne (...args) {
    return this._realTable('findOne', args)
  }

  insert (...args) {
    return this._realTable('insert', args)
  }

  destroy (...args) {
    return this._realTable('destroy', args)
  }

  update (...args) {
    return this._realTable('update', args)
  }

  updateOne (...args) {
    return this._realTable('updateOne', args)
  }
}

module.exports = MaybeTable
