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
    queries[Path.basename(script, '.sql')] = new PG.QueryFile(Path.join(dir, script), { minify: true, debug: process.env.NODE_ENV !== 'production' });
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

    return this.db.task((t) => {

      return t.batch([
        t.query('SELECT table_name,column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = \'public\''),
        t.query('SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\'')
      ]);
    }).then((data) => {

      this.columns = data[0].reduce((total, row) => {

        total[row.table_name] = Object.assign({}, total[row.table_name]);
        total[row.table_name][row.column_name] = {
          type: row.data_type,
          default: row.column_default,
          nullable: row.is_nullable === 'YES'
        };

        return total;
      }, {});
      this.tables = Object.keys(this.columns);
      this.routines = data[1].map((routine) => routine.routine_name);
      return new Database(this.db, this.tables, this.columns, this.routines, this.scripts);
    });
  }
}

module.exports = Muckraker;
