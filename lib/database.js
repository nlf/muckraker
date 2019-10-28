'use strict'

const PG = require('pg-promise')
const path = require('path')
const Table = require('./table')
const scripts = require('./scripts')

const defaultTimestamps = { created: 'created_at', updated: 'updated_at', deleted: 'deleted_at' }

class Database {
  constructor (options) {
    this.options = Object.assign({ scriptDir: path.join(process.cwd(), 'db') }, options)
    this.options.encrypt = Object.assign({ cipher: 'aes256' }, options.encrypt)
    this.options.timestamps = Object.assign({ created: 'created_at', updated: 'updated_at', deleted: 'deleted_at' }, options.timestamps)
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
    const results = await this._db.query(`SELECT table_name,column_name,udt_name::regtype as data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = 'public'`)

    this._columns = results.reduce((total, row) => {
      const key = `${row.table_name}.${row.column_name}`

      const encrypted = this.options.encrypt.hasOwnProperty(key)
      let encryptionCipher, encryptionKey
      if (encrypted) {
        encryptionCipher = this.options.encrypt[key].cipher || this.options.encrypt.cipher
        encryptionKey = this.options.encrypt[key].key
      }

      total[row.table_name] = Object.assign({}, total[row.table_name])
      total[row.table_name][row.column_name] = {
        type: row.data_type,
        default: row.column_default,
        nullable: row.is_nullable === 'YES',
        encrypted,
        encryptionCipher,
        encryptionKey
      }

      return total
    }, {})

    this._tables = Object.keys(this._columns)
    for (const table of this._tables) {
      let timestamps = { created: this.options.timestamps.created, updated: this.options.timestamps.updated, deleted: this.options.timestamps.deleted }
      if (this.options.timestamps.hasOwnProperty(table)) {
        timestamps = Object.assign(timestamps, this.options.timestamps[table])
      }
      this[table] = new Table(this._db, table, this._columns[table], this._scripts[table], timestamps)
    }
  }

  query () {
    return this._db.query.apply(this._db, arguments)
  }

  _cloneWithConnection (connection) {
    const clone = Object.create(this)
    clone._db = connection

    for (const table of this._tables) {
      clone[table] = Object.create(this[table])
      clone[table]._db = connection
    }

    return clone
  }

  async task (tag, fn) {
    await this._ready
    if (!fn) {
      fn = tag
      tag = undefined
    }

    return this._db.task(tag, (t) => {
      const clone = this._cloneWithConnection(t)
      return fn(clone)
    })
  }

  async tx (opts, fn) {
    await this._ready
    if (!fn) {
      fn = opts
      opts = {}
    }

    return this._db.tx(opts, (t) => {
      const clone = this._cloneWithConnection(t)
      return fn(clone)
    })
  }
}

module.exports = Database
