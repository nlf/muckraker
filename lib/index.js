'use strict';

const Fs = require('fs');
const Path = require('path');
const PG = require('pg-promise');
const Database = require('./database');

const internals = {};
internals.loadDir = function (dir) {

  let scripts;
  const queries = {};

  try {
    scripts = Fs.readdirSync(dir).filter((file) => Path.extname(file) === '.sql');
  }
  catch (e) {
    // let's not bother trying to get coverage for fs errors
    // $lab:coverage:off$
    if (e.code === 'ENOENT') {
      return queries;
    }

    throw e;
    // $lab:coverage:on$
  }

  for (const script of scripts) {
    queries[Path.basename(script, '.sql')] = Fs.readFileSync(Path.join(dir, script), 'utf8').trim();
  }

  return queries;
};

class Muckraker {
  constructor(options) {

    this.pg = PG(options.pg);
    this.db = this.pg(options.connection);
    this.scripts = internals.loadDir(options.scriptDir || Path.join(process.cwd(), 'db'));
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

      return new Database(this.db, this.tables, this.routines, this.scripts);
    });
  }
}

module.exports = Muckraker;
