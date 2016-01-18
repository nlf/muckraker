'use strict';

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

class Database {
  constructor(db, tables, routines, scripts) {

    const self = this;
    this._db = db;
    this._tables = tables;

    const wrapRoutine = function (routine, single) {

      return function () {

        return self._db.func(routine, Array.from(arguments), single ? 5 : 6);
      };
    };

    const wrapScript = function (script, single) {

      return function () {

        return self._db.query(script, Array.from(arguments), single ? 5 : 6);
      };
    };

    for (const table of tables) {
      this[table] = new Table(this._db, table);
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
