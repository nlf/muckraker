'use strict'

const PG = require('pg-promise')
const Table = require('./table')
const path = require('path')
const scripts = require('./scripts')

class Database {
  constructor (options) {
    this.options = Object.assign({}, { encrypt: {}, cipher: 'aes256' }, options)
    this._pg = PG(this.options.pg)
    this.end = this._pg.end.bind(this._pg)
    this.txMode = this._pg.txMode
    // Our tests are all mocked so we should skip coverage here
    /* istanbul ignore next */
    this._db = this.options._mocked || this._pg(this.options.connection)
    this._scripts = scripts.load(this, this.options.scriptDir || path.join(process.cwd(), 'db'))
    this._ready = this.init()
  }

  async init () {
    const results = await this._db.query('SELECT table_name,column_name,udt_name::regtype as data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = \'public\'')

    this._columns = results.reduce((total, row) => {
      const key = `${row.table_name}.${row.column_name}`
      total[row.table_name] = Object.assign({}, total[row.table_name])
      total[row.table_name][row.column_name] = {
        type: row.data_type,
        default: row.column_default,
        nullable: row.is_nullable === 'YES',
        encrypted: this.options.encrypt.hasOwnProperty(key),
        encryptionKey: this.options.encrypt[key]
      }

      return total
    }, {})
    this._tables = Object.keys(this._columns)
    for (const table of this._tables) {
      this[table] = new Table(this._db, table, this._columns[table], this._scripts[table], this.options.cipher)
    }
  }

  query () {
    return this._db.query.apply(this._db, arguments)
  }

  async task (tag, fn) {
    await this._ready
    if (!fn) {
      fn = tag
      tag = undefined
    }

    return this._db.task(tag, (t) => {
      return fn(t)
    })
  }

  async tx (opts, fn) {
    await this._ready
    if (!fn) {
      fn = opts
      opts = {}
    }

    return this._db.tx(opts, (t) => {
      const mr = Object.create(this)
      mr._db = t

      for (const table of this._tables) {
        mr[table] = Object.create(this[table])
        mr[table]._db = t
      }

      return fn(mr)
    })
  }
}

module.exports = Database
