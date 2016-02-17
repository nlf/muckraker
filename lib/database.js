'use strict';

const Table = require('./table');

const internals = {};
internals.parseName = function (name, tables) {

  const result = {
    table: null,
    single: false
  };

  for (const table of tables) {
    if (name.startsWith(table)) {
      result.table = table;
      break;
    }
  }

  result.single = result.table ? name.startsWith(`${result.table}_one`) : name.startsWith('one_');
  result.fn = result.table ? name.substring(result.table.length + (result.single ? 5 : 1)) : (result.single ? name.substring(4) : name);
  return result;
};

class Database {
  constructor(db, tables, columns, routines, scripts) {

    const self = this;
    this._db = db;
    this._tables = tables;
    this._columns = columns;

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
