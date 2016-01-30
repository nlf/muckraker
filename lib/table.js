'use strict';

const PG = require('pg-promise');

class Table {
  constructor(db, name, columns) {

    this._db = db;
    this._name = name;
    this._columns = columns;
  }

  _formatQuery(input, prefix) {

    input = Object.assign({}, input);
    const params = { _table: this._name };
    const conditions = [];

    if (this._columns.hasOwnProperty('deleted_at') &&
        !input.hasOwnProperty('deleted_at')) {

      input.deleted_at = null;
    }

    for (const column in input) {
      if (!this._columns.hasOwnProperty(column)) {
        continue;
      }

      const name = prefix ? `_query_${column}` : column;
      const value = input[column];

      if (typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)) {

        if (value === null ||
            value === undefined) {

          conditions.push(`"${column}" IS NULL`);
          continue;
        }

        conditions.push(`"${column}" = $[${name}]`);
        params[name] = value;
        continue;
      }

      let plain = true;
      let operator = '=';
      const k = Object.keys(value)[0];
      if (value[k] === null) {
        if (k === '$eq') {
          conditions.push(`"${column}" IS NULL`);
        }
        else {
          conditions.push(`"${column}" IS NOT NULL`);
        }
        continue;
      }

      if (k === '$gt') {
        operator = '>';
        plain = false;
      }
      else if (k === '$gte') {
        operator = '>=';
        plain = false;
      }
      else if (k === '$lt') {
        operator = '<';
        plain = false;
      }
      else if (k === '$lte') {
        operator = '<=';
        plain = false;
      }
      else if (k === '$ne') {
        operator = '!=';
        plain = false;
      }
      else if (k === '$eq') {
        plain = false;
      }
      else if (k === '$in') {
        operator = 'IN';
        plain = false;
      }
      else if (k === '$like') {
        operator = 'LIKE';
        plain = false;
      }
      else if (k === '$nlike') {
        operator = 'NOT LIKE';
        plain = false;
      }

      if (plain) {
        if (value instanceof Date) {
          conditions.push(`"${column}" = ${PG.as.date(value)}`);
        }
        else {
          conditions.push(`"${column}" = ${PG.as.json(value)}`);
        }
        continue;
      }

      conditions.push(`"${column}" ${operator} $[${name}]`);
      params[name] = value[k];
    }

    return { conditions, params };
  }

  _formatData(input, prefix, update) {

    const params = { _table: this._name };
    const data = [];
    for (const column in input) {
      if (!this._columns.hasOwnProperty(column)) {
        continue;
      }

      const name = prefix ? `_data_${column}` : column;
      const value = input[column];

      if (this._columns[column].type === 'jsonb' ||
          this._columns[column].type === 'json') {

        params[name] = `${PG.as.json(value, true)}`;
      }
      else {
        params[name] = value;
      }

      data.push(`"${column}"`);
    }

    const now = new Date();
    const createdName = prefix ? '_data_created_at' : 'created_at';
    const updatedName = prefix ? '_data_updated_at' : 'updated_at';

    if (!update &&
        this._columns.hasOwnProperty('created_at') &&
        !params.hasOwnProperty(createdName)) {

      params[createdName] = now;
      data.push('"created_at"');
    }

    if (this._columns.hasOwnProperty('updated_at') &&
        !params.hasOwnProperty(updatedName)) {

      params[updatedName] = now;
      data.push('"updated_at"');
    }

    return { data, params };
  }

  find(when) {

    const formatted = this._formatQuery(when);
    let query = `SELECT * FROM "$[_table^]"`;
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    return this._db.any(query, formatted.params);
  }

  findOne(when) {

    const formatted = this._formatQuery(when);
    let query = `SELECT * FROM "$[_table^]"`;
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    return this._db.oneOrNone(query, formatted.params);
  }

  insert(data) {

    const formatted = this._formatData(data);
    const placeholders = formatted.data.map((param) => `$[${param.slice(1, param.length - 1)}]`);
    const query = `INSERT INTO "$[_table^]" (${formatted.data.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    return this._db.oneOrNone(query, formatted.params);
  }

  destroy(when) {

    const formatted = this._formatQuery(when);
    let query;

    if (this._columns.hasOwnProperty('deleted_at')) {
      formatted.params.deleted_at = new Date();
      query = 'UPDATE "$[_table^]" SET ("deleted_at") VALUES ($[deleted_at])';
    }
    else {
      query = `DELETE FROM "$[_table^]"`;
    }

    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND' )}`;
    }
    return this._db.none(query, formatted.params);
  }

  update(when, data) {

    const q = this._formatQuery(when, true);
    const insert = this._formatData(data, true, true);
    const formatted = { conditions: q.conditions, data: insert.data };
    formatted.params = Object.assign({}, q.params, insert.params);
    const values = formatted.data.map((key) => `$[_data_${key.slice(1, key.length - 1)}]`);
    let query = `UPDATE "$[_table^]" SET (${formatted.data.join(', ')}) = (${values.join(', ')})`;
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.any(query, formatted.params);
  }

  updateOne(when, data) {

    const q = this._formatQuery(when, true);
    const insert = this._formatData(data, true, true);
    const formatted = { conditions: q.conditions, data: insert.data };
    formatted.params = Object.assign({}, q.params, insert.params);
    const values = formatted.data.map((key) => `$[_data_${key.slice(1, key.length - 1)}]`);
    let query = `UPDATE "$[_table^]" SET (${formatted.data.join(', ')}) = (${values.join(', ')})`;
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.oneOrNone(query, formatted.params);
  }
}

module.exports = Table;
