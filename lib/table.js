'use strict'

const PG = require('pg-promise')
const internals = {}

internals.operators = {
  $eq: (value) => {
    if (value === null) {
      return { op: 'IS', value: 'NULL', raw: true }
    }

    return { op: '=', value: value }
  },
  $ne: (value) => {
    if (value === null) {
      return { op: 'IS NOT', value: 'NULL', raw: true }
    }

    return { op: '!=', value: value }
  },
  $lt: (value) => {
    return { op: '<', value }
  },
  $lte: (value) => {
    return { op: '<=', value }
  },
  $gt: (value) => {
    return { op: '>', value }
  },
  $gte: (value) => {
    return { op: '>=', value }
  },
  $like: (value) => {
    return { op: 'LIKE', value }
  },
  $nlike: (value) => {
    return { op: 'NOT LIKE', value }
  },
  $in: (value) => {
    return { op: 'IN', value: `(${PG.as.csv(value)})`, raw: true }
  },
  $nin: (value) => {
    return { op: 'NOT IN', value: `(${PG.as.csv(value)})`, raw: true }
  }
}
internals.operators.undefined = internals.operators.$eq

internals.operatorList = Object.keys(internals.operators)
internals.keyArray = (obj) => {
  const path = []
  if (typeof obj !== 'object' ||
      obj === null) {
    return { path, value: obj }
  }

  const keys = Object.keys(obj)
  const key = keys[0]
  if (internals.operatorList.indexOf(key) > -1) {
    return { path, operator: key, value: obj[key] }
  }

  path.push(key)
  const next = internals.keyArray(obj[key])
  return { path: path.concat(next.path), value: next.value, operator: next.operator }
}

class Table {
  constructor (db, name, columns, scripts, cipher, timestamps) {
    this._db = db
    this._name = name
    this._columns = columns
    this._cipher = cipher
    this._timestamps = timestamps

    for (const key in scripts) {
      const script = scripts[key]
      this[script.name] = script.execute
    }
  }

  _formatColumns (columns) {
    let list = columns
    let userDefined = true
    if (!columns) {
      userDefined = false
      list = Object.keys(this._columns)
    }
    return list.filter((column) => {
      if (Array.isArray(column)) {
        const name = column[0]
        return this._columns.hasOwnProperty(name) && (this._columns[name].type === 'jsonb' || this._columns[name].type === 'json')
      }

      return this._columns.hasOwnProperty(column) && (userDefined || !this._columns[column].encrypted)
    }).map((column) => {
      if (Array.isArray(column)) {
        const name = column[0]
        const path = column.slice(1)
        return `"${name}"#>>'{${path.join(',')}}' AS "${path[path.length - 1]}"`
      }

      if (!this._columns[column].encrypted) {
        return `"${column}"`
      }

      return `pgp_sym_decrypt("${column}",'${this._columns[column].encryptionKey}','cipher-algo=${this._cipher}') AS "${column}"`
    })
  }

  _formatQuery (input, prefix, force) {
    input = Object.assign({}, input)
    const params = { _table: this._name }
    const conditions = []

    if (!force &&
        this._columns.hasOwnProperty(this._timestamps.deleted) &&
        !input.hasOwnProperty(this._timestamps.deleted)) {
      input[this._timestamps.deleted] = null
    }

    for (const column in input) {
      if (!this._columns.hasOwnProperty(column)) {
        continue
      }

      const name = prefix ? `_query_${column}` : column
      const value = input[column]

      if (typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)) {
        if (value === null ||
            value === undefined) {
          conditions.push(`"${column}" IS NULL`)
          continue
        }

        conditions.push(`"${column}" = $[${name}]`)
        params[name] = value
        continue
      }

      const k = Object.keys(value)[0]
      if (internals.operatorList.indexOf(k) > -1) {
        const op = internals.operators[k](value[k])
        conditions.push(`"${column}" ${op.op} $[${name + (op.raw ? '^' : '')}]`)
        params[name] = op.value
      } else {
        if (value instanceof Date) {
          conditions.push(`"${column}" = ${PG.as.date(value)}`)
        } else if (this._columns[column].type === 'jsonb' ||
                 this._columns[column].type === 'json') {
          const parsed = internals.keyArray(input[column])
          const op = internals.operators[parsed.operator](parsed.value)
          conditions.push(`"${column}"#>>'{${parsed.path.join(',')}}' ${op.op} $[${name + (op.raw ? '^' : '')}]`)
          params[name] = op.value
        } else {
          conditions.push(`"${column}" = ${PG.as.json(value)}`)
        }
      }
    }

    return { conditions, params }
  }

  _formatData (input, prefix, update) {
    const params = { _table: this._name }
    const data = []
    const columns = []
    for (const column in input) {
      if (!this._columns.hasOwnProperty(column)) {
        continue
      }

      columns.push(`"${column}"`)
      const name = prefix ? `_data_${column}` : column
      const value = input[column]

      if (this._columns[column].type === 'jsonb' ||
          this._columns[column].type === 'json') {
        params[name] = `${PG.as.json(value, true)}`
      } else if (this._columns[column].type.endsWith('[]')) {
        params[name] = `${PG.as.array(value)}::${this._columns[column].type}`
        data.push(`$[${name}^]`)
      } else {
        params[name] = value
      }

      if (this._columns[column].encrypted) {
        data.push(`pgp_sym_encrypt($[${name}],'${this._columns[column].encryptionKey}','cipher-algo=${this._cipher}')`)
      } else if (!this._columns[column].type.endsWith('[]')) {
        data.push(`$[${name}]`)
      }
    }

    const now = new Date()
    const createdName = prefix ? `_data_${this._timestamps.created}` : this._timestamps.created
    const updatedName = prefix ? `_data_${this._timestamps.updated}` : this._timestamps.updated

    if (!update &&
        this._columns.hasOwnProperty(this._timestamps.created) &&
        !params.hasOwnProperty(createdName)) {
      columns.push(`"${this._timestamps.created}"`)
      params[createdName] = now
      data.push(`$[${createdName}]`)
    }

    if (this._columns.hasOwnProperty(this._timestamps.updated) &&
        !params.hasOwnProperty(updatedName)) {
      columns.push(`"${this._timestamps.updated}"`)
      params[updatedName] = now
      data.push(`$[${updatedName}]`)
    }

    return { columns, data, params }
  }

  find (when, columns) {
    const formatted = this._formatQuery(when)
    let query = `SELECT ${this._formatColumns(columns)} FROM $[_table~]`
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`
    }
    return this._db.any(query, formatted.params)
  }

  findOne (when, columns) {
    const formatted = this._formatQuery(when)
    let query = `SELECT ${this._formatColumns(columns)} FROM $[_table~]`
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`
    }
    return this._db.oneOrNone(query, formatted.params)
  }

  insert (data, columns) {
    const formatted = this._formatData(data)
    const query = `INSERT INTO $[_table~] (${formatted.columns.join(',')}) VALUES (${formatted.data.join(',')}) RETURNING ${this._formatColumns(columns)}`
    return this._db.oneOrNone(query, formatted.params)
  }

  destroy (when, options) {
    options = Object.assign({}, options)
    const formatted = this._formatQuery(when, false, true)
    let query

    if (this._columns.hasOwnProperty(this._timestamps.deleted) &&
        !options.force) {
      formatted.params[this._timestamps.deleted] = new Date()
      query = `UPDATE $[_table~] SET "${this._timestamps.deleted}" = $[${this._timestamps.deleted}]`
    } else {
      query = 'DELETE FROM $[_table~]'
    }

    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`
    }
    return this._db.none(query, formatted.params)
  }

  update (when, data, columns) {
    const q = this._formatQuery(when, true)
    const insert = this._formatData(data, true, true)
    const params = Object.assign({}, q.params, insert.params)
    let query = 'UPDATE $[_table~] SET '
    query += insert.columns.map((column, i) => `${column} = ${insert.data[i]}`).join(', ')
    if (q.conditions.length) {
      query += ` WHERE ${q.conditions.join(' AND ')}`
    }
    query += ` RETURNING ${this._formatColumns(columns)}`
    return this._db.any(query, params)
  }

  updateOne (when, data, columns) {
    const q = this._formatQuery(when, true)
    const insert = this._formatData(data, true, true)
    const params = Object.assign({}, q.params, insert.params)
    let query = 'UPDATE $[_table~] SET '
    query += insert.columns.map((column, i) => `${column} = ${insert.data[i]}`).join(', ')
    if (q.conditions.length) {
      query += ` WHERE ${q.conditions.join(' AND ')}`
    }
    query += ` RETURNING ${this._formatColumns(columns)}`
    return this._db.oneOrNone(query, params)
  }
}

module.exports = Table
