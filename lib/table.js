'use strict'

const QueryBuilder = require('./querybuilder')

class Table {
  constructor (db, name, columns, scripts, timestamps) {
    this._db = db
    this._name = name
    this._columns = columns
    this._timestamps = timestamps

    for (const key in scripts) {
      const script = scripts[key]
      this[script.name] = script.execute
    }

    this._builder = new QueryBuilder(this)
  }

  find (when, columns) {
    const where = this._builder.generateWhere(when)
    let query = `SELECT ${this._builder.getColumnNames(columns)} FROM $[_table~]`
    if (where.conditions.length) {
      query += ` WHERE ${where.conditions.join(' AND ')}`
    }
    return this._db.any(query, where.params)
  }

  findOne (when, columns) {
    const where = this._builder.generateWhere(when)
    let query = `SELECT ${this._builder.getColumnNames(columns)} FROM $[_table~]`
    if (where.conditions.length) {
      query += ` WHERE ${where.conditions.join(' AND ')}`
    }
    return this._db.oneOrNone(query, where.params)
  }

  insert (data, columns) {
    const input = this._builder.parseInput(data)
    const query = `INSERT INTO $[_table~] (${input.columns.join(',')}) VALUES (${input.data.join(',')}) RETURNING ${this._builder.getColumnNames(columns)}`
    return this._db.oneOrNone(query, input.params)
  }

  destroy (when, options = {}) {
    const where = this._builder.generateWhere(when, false, true)
    let query

    // options.force = true means "skip the soft delete and really delete"
    if (this._columns.hasOwnProperty(this._timestamps.deleted) && !options.force) {
      where.params[this._timestamps.deleted] = new Date()
      query = `UPDATE $[_table~] SET "${this._timestamps.deleted}" = $[${this._timestamps.deleted}]`
    } else {
      query = 'DELETE FROM $[_table~]'
    }

    if (where.conditions.length) {
      query += ` WHERE ${where.conditions.join(' AND ')}`
    }
    return this._db.none(query, where.params)
  }

  update (when, data, columns) {
    const where = this._builder.generateWhere(when, true)
    const input = this._builder.parseInput(data, true, true)
    const params = Object.assign({}, where.params, input.params)
    let query = 'UPDATE $[_table~] SET '
    query += input.columns.map((column, i) => `${column} = ${input.data[i]}`).join(', ')
    if (where.conditions.length) {
      query += ` WHERE ${where.conditions.join(' AND ')}`
    }
    query += ` RETURNING ${this._builder.getColumnNames(columns)}`
    return this._db.any(query, params)
  }

  updateOne (when, data, columns) {
    const where = this._builder.generateWhere(when, true)
    const input = this._builder.parseInput(data, true, true)
    const params = Object.assign({}, where.params, input.params)
    let query = 'UPDATE $[_table~] SET '
    query += input.columns.map((column, i) => `${column} = ${input.data[i]}`).join(', ')
    if (where.conditions.length) {
      query += ` WHERE ${where.conditions.join(' AND ')}`
    }
    query += ` RETURNING ${this._builder.getColumnNames(columns)}`
    return this._db.oneOrNone(query, params)
  }
}

module.exports = Table
