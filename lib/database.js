'use strict';

const Joi = require('joi');
const Table = require('./table');

const internals = {};
internals.parseName = function (name, tables) {

  const result = {
    table: null,
    single: false
  };

  const parts = name.split('_', 3);
  if (tables.indexOf(parts[0]) !== -1) {
    result.table = parts[0];
    if (parts[1] === 'one') {
      result.single = true;
      result.fn = name.substring(result.table.length + 5);
    }
    else {
      result.fn = name.substring(result.table.length + 1);
    }
  }
  else {
    if (parts[0] === 'one') {
      result.single = true;
      result.fn = name.substring(4);
    }
    else {
      result.fn = name;
    }
  }

  return result;
};

internals.generateValidators = function (tables) {

  const validators = {};
  for (const table in tables) {
    const columns = tables[table];
    validators[table] = {};

    for (const column in columns) {
      const meta = columns[column];
      let validator;
      switch (meta.type) {
        case 'jsonb':
          validator = Joi.alternatives().try(Joi.object(), Joi.array());
          break;
        case 'character varying':
        case 'text':
          validator = Joi.string();
          break;
        case 'uuid':
          validator = Joi.string().guid();
          break;
        case 'timestamp with time zone':
          validator = Joi.date();
          break;
        case 'integer':
          validator = Joi.number().integer();
          break;
        default:
          validator = Joi.any();
      }

      if (!meta.nullable &&
          !meta.default) {

        validator = validator.required();
      }

      validators[table][column] = validator;
    }
  }

  return validators;
};

class Database {
  constructor(db, tables, columns, routines, scripts) {

    const self = this;
    this._db = db;
    this._tables = tables;
    this._columns = columns;
    this.validators = internals.generateValidators(columns);

    const wrapRoutine = function (routine, single) {

      return function () {

        return self._db.func(routine, Array.from(arguments), single ? 5 : 6);
      };
    };

    const wrapScript = function (script, single) {

      return function (arg) {

        return self._db.query.apply(self._db, [script, arg, single ? 5 : 6]);
      };
    };

    for (const table of tables) {
      this[table] = new Table(this._db, table, columns[table]);
    }

    for (const routine of routines) {
      const parsed = internals.parseName(routine, this._tables);
      if (parsed.table) {
        this[parsed.table][parsed.fn] = wrapRoutine(routine, parsed.single);
      }
      else {
        this[parsed.fn] = wrapRoutine(routine, parsed.single);
      }
    }

    for (const script in scripts) {
      const parsed = internals.parseName(script, this._tables);
      if (parsed.table) {
        this[parsed.table][parsed.fn] = wrapScript(scripts[script], parsed.single);
      }
      else {
        this[parsed.fn] = wrapScript(scripts[script], parsed.single);
      }
    }
  }

  query() {

    return this._db.query.apply(this._db, arguments);
  }
}

module.exports = Database;
