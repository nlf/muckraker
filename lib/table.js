'use strict';

const PG = require('pg-promise');

class Table {
  constructor(db, name, columns) {

    this._db = db;
    this._name = name;
    this._columns = columns;
  }

  _formatQuery(input) {

    const params = { _table: this._name };
    const condition = [];
    for (const key in input) {
      if (!this._columns.hasOwnProperty(key)) {
        continue;
      }

      if (this._columns[key].type === 'jsonb' ||
          this._columns[key].type === 'json') {

        condition.push(`"${key}"=${PG.as.json(input[key])}`);
      }
      else {
        condition.push(`"${key}"=$[${key}]`);
        params[key] = input[key];
      }
    }

    return { condition, params };
  }

  _formatInsert(input) {

    const params = { _table: this._name };
    const data = [];
    for (const key in input) {
      if (!this._columns.hasOwnProperty(key)) {
        continue;
      }

      if (this._columns[key].type === 'jsonb' ||
          this._columns[key].type === 'json') {

        params[key] = `${PG.as.json(input[key], true)}`;
      }
      else {
        params[key] = input[key];
      }

      data.push(`"${key}"`);
    }

    return { data, params };
  }

  _formatUpdate(when, input) {

    const params = { _table: this._name };
    const condition = [];
    for (const key in when) {
      if (!this._columns.hasOwnProperty(key)) {
        continue;
      }

      if (this._columns[key].type === 'jsonb' ||
          this._columns[key].type === 'json') {

        condition.push(`"${key}"=${PG.as.json(when[key])}`);
      }
      else {
        params[`when_${key}`] = when[key];
        condition.push(`"${key}"=$[when_${key}]`);
      }
    }

    const data = [];
    for (const key in input) {
      if (!this._columns.hasOwnProperty(key)) {
        continue;
      }

      if (this._columns[key].type === 'jsonb' ||
          this._columns[key].type === 'json') {

        params[`data_${key}`] = `${PG.as.json(input[key], true)}`;
      }
      else {
        params[`data_${key}`] = input[key];
      }
      data.push(`"${key}"`);
    }

    return { condition, data, params };
  }

  find(when) {

    const formatted = this._formatQuery(when);
    let query = `SELECT * FROM "$[_table^]"`;
    if (formatted.condition.length) {
      query += ` WHERE ${formatted.condition.join(' AND ')}`;
    }
    return this._db.any(query, formatted.params);
  }

  findOne(when) {

    const formatted = this._formatQuery(when);
    let query = `SELECT * FROM "$[_table^]"`;
    if (formatted.condition.length) {
      query += ` WHERE ${formatted.condition.join(' AND ')}`;
    }
    return this._db.one(query, formatted.params);
  }

  insert(data) {

    const formatted = this._formatInsert(data);
    const placeholders = formatted.data.map((param) => `$[${param.slice(1, param.length - 1)}]`);
    const query = `INSERT INTO "$[_table^]" (${formatted.data.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    return this._db.one(query, formatted.params);
  }

  destroy(when) {

    const formatted = this._formatQuery(when);
    let query = `DELETE FROM "$[_table^]"`;
    if (formatted.condition.length) {
      query += ` WHERE ${formatted.condition.join(' AND' )}`;
    }
    return this._db.none(query, formatted.params);
  }

  update(when, data) {

    const formatted = this._formatUpdate(when, data);
    const values = formatted.data.map((key) => `$[data_${key.slice(1, key.length - 1)}]`);
    let query = `UPDATE "$[_table^]" SET (${formatted.data.join(', ')}) = (${values.join(', ')})`;
    if (formatted.condition.length) {
      query += ` WHERE ${formatted.condition.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.any(query, formatted.params);
  }

  updateOne(when, data) {

    const formatted = this._formatUpdate(when, data);
    const values = formatted.data.map((key) => `$[data_${key.slice(1, key.length - 1)}]`);
    let query = `UPDATE "$[_table^]" SET (${formatted.data.join(', ')}) = (${values.join(', ')})`;
    if (formatted.condition.length) {
      query += ` WHERE ${formatted.condition.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.one(query, formatted.params);
  }
}

module.exports = Table;
