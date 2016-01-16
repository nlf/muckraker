'use strict';

const Table = require('./table');

class Database {
  constructor(db, tables, routines, scripts) {

    const self = this;
    this._db = db;
    const wrapRoutine = function (routine) {

      return function () {

        return self._db.func(routine, Array.from(arguments));
      };
    };

    const wrapScript = function (script) {

      return function () {

        return self._db.query(script, Array.from(arguments));
      };
    };

    for (const table of tables) {
      this[table] = new Table(this._db, table);
    }

    for (const routine of routines) {
      const table = routine.split('_', 1)[0];
      const name = routine.substring(table.length + 1);
      if (tables.indexOf(table) === -1) {
        this[routine] = wrapRoutine(routine);
      }
      else {
        this[table][name] = wrapRoutine(routine);
      }
    }

    for (const script in scripts) {
      const contents = scripts[script];
      const table = script.split('_', 1)[0];
      const name = script.substring(table.length + 1);
      if (tables.indexOf(table) === -1) {
        this[script] = wrapScript(contents);
      }
      else {
        this[table][name] = wrapScript(contents);
      }
    }
  }

  query() {

    return this._db.query.apply(this._db, arguments);
  }
}

module.exports = Database;
