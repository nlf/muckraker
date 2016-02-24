'use strict';

const PG = require('pg-promise');
const internals = {};

internals.operators = {
  $eq: (value) => {

    if (value === null) {
      return { op: 'IS', value: 'NULL', raw: true };
    }

    return { op: '=', value: value };
  },
  $ne: (value) => {

    if (value === null) {
      return { op: 'IS NOT', value: 'NULL', raw: true };
    }

    return { op: '!=', value: value };
  },
  $lt: (value) => {

    return { op: '<', value };
  },
  $lte: (value) => {

    return { op: '<=', value };
  },
  $gt: (value) => {

    return { op: '>', value };
  },
  $gte: (value) => {

    return { op: '>=', value };
  },
  $like: (value) => {

    return { op: 'LIKE', value };
  },
  $nlike: (value) => {

    return { op: 'NOT LIKE', value };
  },
  $in: (value) => {

    return { op: 'IN', value: `(${PG.as.csv(value)})`, raw: true };
  },
  $nin: (value) => {

    return { op: 'NOT IN', value: `(${PG.as.csv(value)})`, raw: true };
  }
};
internals.operators.undefined = internals.operators.$eq;

internals.operatorList = Object.keys(internals.operators);
internals.keyArray = (obj) => {

  const path = [];
  if (typeof obj !== 'object' ||
      obj === null) {

    return { path, value: obj };
  }

  const keys = Object.keys(obj);
  const key = keys[0];
  if (internals.operatorList.indexOf(key) > -1) {
    return { path, operator: key, value: obj[key] };
  }

  path.push(key);
  const next = internals.keyArray(obj[key]);
  return { path: path.concat(next.path), value: next.value, operator: next.operator };
};

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

      const k = Object.keys(value)[0];
      if (internals.operatorList.indexOf(k) > -1) {
        const op = internals.operators[k](value[k]);
        conditions.push(`"${column}" ${op.op} $[${name + (op.raw ? '^' : '')}]`);
        params[name] = op.value;
      }
      else {
        if (value instanceof Date) {
          conditions.push(`"${column}" = ${PG.as.date(value)}`);
        }
        else if (this._columns[column].type === 'jsonb' ||
                 this._columns[column].type === 'json') {

          const parsed = internals.keyArray(input[column]);
          const op = internals.operators[parsed.operator](parsed.value);
          conditions.push(`"${column}"#>>'{${parsed.path.join(',')}}' ${op.op} $[${name + (op.raw ? '^' : '')}]`);
          params[name] = op.value;
        }
        else {
          conditions.push(`"${column}" = ${PG.as.json(value)}`);
        }
      }
    }

    return { conditions, params };
  }

  _formatData(input, prefix, update) {

    const params = { _table: this._name };
    const data = [];
    const columns = [];
    for (const column in input) {
      if (!this._columns.hasOwnProperty(column)) {
        continue;
      }

      columns.push(`"${column}"`);
      const name = prefix ? `_data_${column}` : column;
      const value = input[column];

      if (this._columns[column].type === 'jsonb' ||
          this._columns[column].type === 'json') {

        params[name] = `${PG.as.json(value, true)}`;
      }
      else {
        params[name] = value;
      }

      if (this._columns[column].encrypted) {
        data.push(`pgp_sym_encrypt($[${name}], '${this._columns[column].encryptionKey}', 'cipher-algo=aes256')`);
      }
      else {
        data.push(`$[${name}]`);
      }
    }

    const now = new Date();
    const createdName = prefix ? '_data_created_at' : 'created_at';
    const updatedName = prefix ? '_data_updated_at' : 'updated_at';

    if (!update &&
        this._columns.hasOwnProperty('created_at') &&
        !params.hasOwnProperty(createdName)) {

      columns.push('"created_at"');
      params[createdName] = now;
      data.push(`$[${createdName}]`);
    }

    if (this._columns.hasOwnProperty('updated_at') &&
        !params.hasOwnProperty(updatedName)) {

      columns.push('"updated_at"');
      params[updatedName] = now;
      data.push(`$[${updatedName}]`);
    }

    return { columns, data, params };
  }

  find(when) {

    const formatted = this._formatQuery(when);
    let query = 'SELECT * FROM $[_table~]';
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    return this._db.any(query, formatted.params);
  }

  findOne(when) {

    const formatted = this._formatQuery(when);
    let query = 'SELECT * FROM $[_table~]';
    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND ')}`;
    }
    return this._db.oneOrNone(query, formatted.params);
  }

  insert(data) {

    const formatted = this._formatData(data);
    const query = `INSERT INTO $[_table~] (${formatted.columns.join(', ')}) VALUES (${formatted.data.join(', ')}) RETURNING *`;
    return this._db.oneOrNone(query, formatted.params);
  }

  destroy(when) {

    const formatted = this._formatQuery(when);
    let query;

    if (this._columns.hasOwnProperty('deleted_at')) {
      formatted.params.deleted_at = new Date();
      query = 'UPDATE $[_table~] SET ("deleted_at") VALUES ($[deleted_at])';
    }
    else {
      query = 'DELETE FROM $[_table~]';
    }

    if (formatted.conditions.length) {
      query += ` WHERE ${formatted.conditions.join(' AND' )}`;
    }
    return this._db.none(query, formatted.params);
  }

  update(when, data) {

    const q = this._formatQuery(when, true);
    const insert = this._formatData(data, true, true);
    const params = Object.assign({}, q.params, insert.params);
    let query = `UPDATE $[_table~] SET (${insert.columns.join(', ')}) = (${insert.data.join(', ')})`;
    if (q.conditions.length) {
      query += ` WHERE ${q.conditions.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.any(query, params);
  }

  updateOne(when, data) {

    const q = this._formatQuery(when, true);
    const insert = this._formatData(data, true, true);
    const params = Object.assign({}, q.params, insert.params);
    let query = `UPDATE $[_table~] SET (${insert.columns.join(', ')}) = (${insert.data.join(', ')})`;
    if (q.conditions.length) {
      query += ` WHERE ${q.conditions.join(' AND ')}`;
    }
    query += ' RETURNING *';
    return this._db.oneOrNone(query, params);
  }
}

module.exports = Table;
