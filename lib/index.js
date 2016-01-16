'use strict';

const PG = require('pg-promise');
const Database = require('./database');

class Muckraker {
  constructor(options) {

    this.pg = PG(options.pg);
    this.db = this.pg(options.connection);
  }

  connect() {

    return this.db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'').then((tables) => {

      this.tables = tables.map((table) => table.table_name);
      return;
    }).then(() => {

      return this.db.query('SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\'');
    }).then((routines) => {

      this.routines = routines.map((routine) => routine.routine_name);
      return;
    }).then(() => {

      return new Database(this.db, this.tables, this.routines);
    });
  }
}

module.exports = Muckraker;
