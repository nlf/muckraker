'use strict'

const PG = require('pg-promise')

const operators = {
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
operators.undefined = operators.$eq

const operatorList = Object.keys(operators)

// given an object representing what a user is attempting to query
// search for an operator as a subkey
function findOp (obj) {
  const path = []
  if (typeof obj !== 'object' ||
      obj === null) {
    return { path, value: obj }
  }

  const keys = Object.keys(obj)
  const key = keys[0]
  if (operatorList.indexOf(key) > -1) {
    return { path, operator: key, value: obj[key] }
  }

  path.push(key)
  const next = findOp(obj[key])
  return { path: path.concat(next.path), value: next.value, operator: next.operator }
}

class QueryBuilder {
  constructor ({ _columns: columns, _name: table, _timestamps: timestamps }) {
    this._columns = columns
    this._table = table
    this._timestamps = timestamps
  }

  getColumnNames (columns) {
    let userDefined
    if (!columns) {
      columns = Object.keys(this._columns)
    } else {
      userDefined = true
    }

    return columns.filter((column) => {
      // if column is passed as an array, we're requesting a json field so make
      // sure the first entry is the name of a valid column
      if (Array.isArray(column)) {
        const name = column[0]
        return this._columns.hasOwnProperty(name) && ['json', 'jsonb'].includes(this._columns[name].type)
      }

      // we omit encrypted columns unless the user specifically asks for them
      return this._columns.hasOwnProperty(column) && (userDefined || !this._columns[column].encrypted)
    }).map((column) => {
      if (Array.isArray(column)) {
        const [name, ...path] = column
        return `"${name}"#>>'{${path.join(',')}}' AS "${path[path.length - 1]}"`
      }

      if (!this._columns[column].encrypted) {
        return `"${column}"`
      }

      return `pgp_sym_decrypt("${column}",'${this._columns[column].encryptionKey}','cipher-algo=${this._columns[column].encryptionCipher}') AS "${column}"`
    })
  }

  // generate a WHERE statement
  // 'prefix' is 'true' when this is used in conjunction with an INSERT to avoid overlap of parameter names
  // 'force' is 'true' when the soft deletion column should be ignored
  generateWhere (input = {}, prefix, force) {
    const params = { _table: this._table }
    const conditions = []

    if (!force && this._columns.hasOwnProperty(this._timestamps.deleted) && !input.hasOwnProperty(this._timestamps.deleted)) {
      input[this._timestamps.deleted] = null
    }

    for (const column in input) {
      // skip properties that don't reflect a real column
      if (!this._columns.hasOwnProperty(column)) {
        continue
      }

      const name = prefix ? `_query_${column}` : column
      const value = input[column]

      // simple comparisons
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        if (value === null || value === undefined) {
          conditions.push(`"${column}" IS NULL`)
          continue
        }

        conditions.push(`"${column}" = $[${name}]`)
        params[name] = value
        continue
      }

      if (value instanceof Date) {
        conditions.push(`"${column}" = ${PG.as.date(value)}`)
        continue
      }

      if (['json', 'jsonb'].includes(this._columns[column].type)) {
        const parsed = findOp(input[column])
        const op = operators[parsed.operator](parsed.value)
        conditions.push(`"${column}"#>>'{${parsed.path.join(',')}}' ${op.op} $[${name + (op.raw ? '^' : '')}]`)
        params[name] = op.value
        continue
      }

      const firstKey = Object.keys(value)[0]
      if (operatorList.includes(firstKey)) {
        const op = operators[firstKey](value[firstKey])
        conditions.push(`"${column}" ${op.op} $[${name + (op.raw ? '^' : '')}]`)
        params[name] = op.value
        continue
      }

      conditions.push(`"${column}" = ${PG.as.json(value)}`)
    }

    return { conditions, params }
  }

  // parse input data to make sure types are correct
  // 'prefix' is 'true' when used combined with a WHERE to avoid overlapping parameters
  // 'update' is 'true' when this is used for an UPDATE query instead of INSERT
  parseInput (input, prefix, update) {
    const now = new Date()
    const params = { _table: this._table }
    const data = []
    const columns = []

    for (const column in input) {
      // skip properties that aren't a real column
      if (!this._columns.hasOwnProperty(column)) {
        continue
      }

      columns.push(`"${column}"`)
      const name = prefix ? `_input_${column}` : column
      const value = input[column]

      if (this._columns[column].type.endsWith('[]')) {
        params[name] = `${PG.as.array(value)}::${this._columns[column].type}`
        data.push(`$[${name}^]`)
        continue
      }

      if (['json', 'jsonb'].includes(this._columns[column].type)) {
        params[name] = `${PG.as.json(value, true)}`
      } else {
        params[name] = value
      }

      if (this._columns[column].encrypted) {
        data.push(`pgp_sym_encrypt($[${name}],'${this._columns[column].encryptionKey}','cipher-algo=${this._columns[column].encryptionCipher}')`)
      } else {
        data.push(`$[${name}]`)
      }
    }

    const createdName = prefix ? `_input_${this._timestamps.created}` : this._timestamps.created
    const updatedName = prefix ? `_input_${this._timestamps.updated}` : this._timestamps.updated

    if (!update && this._columns.hasOwnProperty(this._timestamps.created) && !params.hasOwnProperty(createdName)) {
      columns.push(`"${this._timestamps.created}"`)
      params[createdName] = now
      data.push(`$[${createdName}]`)
    }

    if (this._columns.hasOwnProperty(this._timestamps.updated) && !params.hasOwnProperty(updatedName)) {
      columns.push(`"${this._timestamps.updated}"`)
      params[updatedName] = now
      data.push(`$[${updatedName}]`)
    }

    return { columns, data, params }
  }
}

module.exports = QueryBuilder
