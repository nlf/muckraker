'use strict'

const Fs = require('fs')
const Path = require('path')
const PG = require('pg-promise')
const Table = require('./table')

const internals = {}
internals.loadDir = function (dir) {
  let scripts
  const queries = {}

  try {
    scripts = Fs.readdirSync(dir).filter((file) => Path.extname(file) === '.sql')
  } catch (e) {
    // let's not bother trying to get coverage for fs errors
    /* istanbul ignore next */
    if (e.code === 'ENOENT') {
      return queries
    }

    /* istanbul ignore next */
    throw e
  }

  for (const script of scripts) {
    queries[Path.basename(script, '.sql')] = new PG.QueryFile(Path.join(dir, script), { minify: true, debug: process.env.NODE_ENV !== 'production', noWarnings: true })
  }

  return queries
}

internals.parseName = function (name, tables) {
  const result = {
    table: null,
    single: false
  }

  for (const table of tables) {
    if (name.startsWith(table)) {
      result.table = table
      break
    }
  }

  result.single = result.table ? name.startsWith(`${result.table}_one`) : name.startsWith('one_')
  result.fn = result.table ? name.substring(result.table.length + (result.single ? 5 : 1)) : (result.single ? name.substring(4) : name)
  return result
}

internals.wrapRoutine = function (context, routine, single) {
  return function () {
    return context._db.func(routine, Array.from(arguments), single ? 5 : 6)
  }
}

internals.wrapScript = function (context, script, single) {
  return function (arg) {
    return context._db.query(script, arg, single ? 5 : 6)
  }
}

class Muckraker {
  constructor (options) {
    this.options = Object.assign({}, { encrypt: {}, cipher: 'aes256' }, options)
    this._pg = PG(this.options.pg)
    this.end = this._pg.end.bind(this._pg)
    this.txMode = this._pg.txMode
    // Our tests are all mocked so we should skip coverage here
    /* istanbul ignore next */
    this._db = this.options._mocked || this._pg(this.options.connection)

  }

  async init () {
    const results = await this._db.task((t) => {
      return t.batch([
        t.query('SELECT table_name,column_name,udt_name::regtype as data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = \'public\''),
        t.query('SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\'')
      ])
    })

    this._columns = results[0].reduce((total, row) => {
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
      this[table] = new Table(this._db, table, this._columns[table], this.options.cipher)
    }

    this._routines = results[1].map((routine) => routine.routine_name)
    for (const routine of this._routines) {
      const parsed = internals.parseName(routine, this._tables)
      if (parsed.table) {
        this[parsed.table][parsed.fn] = internals.wrapRoutine(this, routine, parsed.single)
      } else {
        this[parsed.fn] = internals.wrapRoutine(this, routine, parsed.single)
      }
    }

    this._scripts = internals.loadDir(this.options.scriptDir || Path.join(process.cwd(), 'db'))
    for (const script in this._scripts) {
      const parsed = internals.parseName(script, this._tables)
      if (parsed.table) {
        this[parsed.table][parsed.fn] = internals.wrapScript(this, this._scripts[script], parsed.single)
      } else {
        this[parsed.fn] = internals.wrapScript(this, this._scripts[script], parsed.single)
      }
    }

    return this
  }

  query () {
    return this._db.query.apply(this._db, arguments)
  }

  tx (opts, fn) {
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

module.exports = Muckraker
