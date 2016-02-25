'use strict';

const Muckraker = require('../');
const Mock = require('./mock');
const Path = require('path');

const lab = exports.lab = require('lab').script();
const expect = require('code').expect;
const it = lab.test;
const describe = lab.experiment;

const internals = {
  connection: {
    host: 'localhost'
  },
  _mocked: new Mock()
};

describe('constructor', () => {

  it('can create an instance of Muckraker', (done) => {

    const db = new Muckraker(internals);
    expect(db).to.exist();
    expect(db).to.be.an.instanceof(Muckraker);
    done();
  });

  it('can create an instance of Muckraker while specifying a different scriptDir', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    expect(db).to.exist();
    expect(db).to.be.an.instanceof(Muckraker);
    done();
  });

  it('correctly throws an error when connection fails', (done) => {

    expect(() => {

      const db = new Muckraker({ _mocked: new Mock(true) });
      expect(db).to.exist();
    }).to.throw(Error, 'Failed to connect');
    done();
  });
});

describe('query', () => {

  it('can send a raw query', (done) => {

    const db = new Muckraker(internals);
    const query = db.query('SELECT * FROM "users"');
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });
});

describe('find', () => {

  it('can find rows in a table', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find();
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users"`);
    done();
  });

  it('can return a subset of columns', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({}, ['id', 'user_name', 'junk']);
    expect(query).to.equal('SELECT "id","user_name" FROM "users"');
    done();
  });

  it('can return a property of a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({}, ['id', ['blob', 'some', 'path']]);
    expect(query).to.equal('SELECT "id","blob"#>>\'{some,path}\' AS "path" FROM "users"');
    done();
  });

  it('ignores invalid json properties', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({}, [['id', 'invalid', 'path'], 'user_name', ['invalid', 'path'], ['json_blob', 'real', 'path']]);
    expect(query).to.equal('SELECT "user_name","json_blob"#>>\'{real,path}\' AS "path" FROM "users"');
    done();
  });

  it('adds a filter for tables with a deleted_at column', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.find();
    expect(query).to.equal(`SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" IS NULL`);
    done();
  });

  it('allows overriding the default filter for tables with a deleted_at column', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.find({ deleted_at: { $ne: null } });
    expect(query).to.equal(`SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" IS NOT NULL`);
    done();
  });

  it('allows overriding the default filter for tables with a deleted_at column by passing a date', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.find({ deleted_at: new Date() });
    const matcher = new RegExp(`SELECT ${db.entries._formatColumns()} FROM "entries" WHERE "deleted_at" = '[^']+'`);
    expect(query).to.match(matcher);
    done();
  });

  it('can compare a column to a json object', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ id: { some: 'thing' } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = '{"some":"thing"}'`);
    done();
  });

  it('can find rows in a table with a condition', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ id: 0, invalid: 'key' });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = 0`);
    done();
  });

  it('can find rows in a table with a condition in a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { test: 'object' } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{test}' = 'object'`);
    done();
  });

  it('can find rows in a table with a column that is null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ unknown: null });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NULL`);
    done();
  });

  it('can find rows in a table with a json value that is null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: null } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`);
    done();
  });

  it('can find rows in a table with a column that is explicitly null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ unknown: { $eq: null } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NULL`);
    done();
  });

  it('can find rows in a table with a json value that is explicitly null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { $eq: null } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NULL`);
    done();
  });

  it('can find rows in a table with a column that is not null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ unknown: { $ne: null } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "unknown" IS NOT NULL`);
    done();
  });

  it('can find rows in a table with a json value that is not null', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { $ne: null } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some}' IS NOT NULL`);
    done();
  });

  it('can use the $gt operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $gt: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" > 1`);
    done();
  });

  it('can use the $gt operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $gt: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' > 5`);
    done();
  });

  it('can use the $gte operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $gte: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" >= 1`);
    done();
  });

  it('can use the $gte operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $gte: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' >= 5`);
    done();
  });

  it('can use the $lt operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $lt: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" < 1`);
    done();
  });

  it('can use the $lt operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $lt: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' < 5`);
    done();
  });

  it('can use the $lte operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $lte: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" <= 1`);
    done();
  });

  it('can use the $lte operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $lte: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' <= 5`);
    done();
  });

  it('can use the $ne operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $ne: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" != 1`);
    done();
  });

  it('can use the $ne operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $ne: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' != 5`);
    done();
  });

  it('can use the $eq operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $eq: 1 } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" = 1`);
    done();
  });

  it('can use the $eq operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $eq: 5 } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' = 5`);
    done();
  });

  it('can use the $in operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $in: [1, 2, 3] } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" IN (1,2,3)`);
    done();
  });

  it('can use the $in operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $in: [1, 2, 3] } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' IN (1,2,3)`);
    done();
  });

  it('can use the $nin operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ pets: { $nin: [1, 3] } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "pets" NOT IN (1,3)`);
    done();
  });

  it('can use the $nin operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $nin: [1, 2, 3] } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' NOT IN (1,2,3)`);
    done();
  });

  it('can use the $like operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ user_name: { $like: 'test' } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "user_name" LIKE 'test'`);
    done();
  });

  it('can use the $like operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $like: 'test' } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' LIKE 'test'`);
    done();
  });

  it('can use the $nlike operator', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ user_name: { $nlike: 'test' } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "user_name" NOT LIKE 'test'`);
    done();
  });

  it('can use the $nlike operator on a json column', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.find({ blob: { some: { value: { $nlike: 'test' } } } });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "blob"#>>'{some,value}' NOT LIKE 'test'`);
    done();
  });
});

describe('findOne', () => {

  it('can find a single row', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.findOne();
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users"`);
    done();
  });

  it('can find a single row with a condition', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.findOne({ id: 0 });
    expect(query).to.equal(`SELECT ${db.users._formatColumns()} FROM "users" WHERE "id" = 0`);
    done();
  });
});

describe('insert', () => {

  it('can insert a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.insert({ id: 0, invalid: 'key', user_name: 'test', blob: { some: 'data' } });
    expect(query).to.equal(`INSERT INTO "users" ("id","user_name","blob") VALUES (0,'test','{"some":"data"}') RETURNING ${db.users._formatColumns()}`);
    done();
  });

  it('can set created_at and updated_at implicitly when creating a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.insert({ value: 'test' });
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\('test','[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`);
    expect(query).to.match(matcher);
    done();
  });

  it('can set an encrypted value and not return it by default', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' } }));
    const query = db.entries.insert({ value: 'test' });
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`);
    expect(query).to.match(matcher);
    done();
  });

  it('can set an encrypted value and return it', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' } }));
    const query = db.entries.insert({ value: 'test' }, Object.keys(db.entries._columns));
    const formattedColumns = db.entries._formatColumns(Object.keys(db.entries._columns)).map((column) => {

      if (column.startsWith('pgp_sym')) {
        column = column.replace('(', '\\(').replace(')', '\\)');
      }

      return column;
    });

    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes256'\\),'[^']+','[^']+'\\) RETURNING ${formattedColumns}`);
    expect(query).to.match(matcher);
    done();
  });

  it('can set an encrypted value with a non-default cipher', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { encrypt: { 'entries.value': 'somekey' }, cipher: 'aes192' }));
    const query = db.entries.insert({ value: 'test' });
    const matcher = new RegExp(`INSERT INTO "entries" \\("value","created_at","updated_at"\\) VALUES \\(pgp_sym_encrypt\\('test','somekey','cipher-algo=aes192'\\),'[^']+','[^']+'\\) RETURNING ${db.entries._formatColumns()}`);
    expect(query).to.match(matcher);
    done();
  });
});

describe('destroy', () => {

  it('can delete a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.destroy();
    expect(query).to.equal('DELETE FROM "users"');
    done();
  });

  it('can delete a row with a condition', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.destroy({ id: 0 });
    expect(query).to.equal('DELETE FROM "users" WHERE "id" = 0');
    done();
  });

  it('can soft delete a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.destroy({ id: 0 });
    expect(query).to.match(/UPDATE "entries" SET \("deleted_at"\) VALUES \('([^\)]+)'\) WHERE "id" = 0/);
    done();
  });
});

describe('update', () => {

  it('can update a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.update({ id: 0, invalid: 'key', blob: { some: 'thing' } }, { user_name: 'test_user', invalid: 'key', blob: { another: 'thing' } });
    expect(query).to.equal(`UPDATE "users" SET ("user_name","blob") = ('test_user','{"another":"thing"}') WHERE "id" = 0 AND "blob"#>>'{some}' = 'thing' RETURNING ${db.users._formatColumns()}`);
    done();
  });

  it('can update a row without a query', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.update(null, { user_name: 'test_user' });
    expect(query).to.equal(`UPDATE "users" SET ("user_name") = ('test_user') RETURNING ${db.users._formatColumns()}`);
    done();
  });

  it('can set the updated_at column implicitly if it exists', (done) => {

    const db = new Muckraker(internals);
    const query = db.entries.update({ value: 'test' }, { value: 'different test' });
    const matcher = new RegExp(`UPDATE "entries" SET \\("value","updated_at"\\) = \\('different test','[^']+'\\) WHERE "value" = 'test' AND "deleted_at" IS NULL RETURNING ${db.entries._formatColumns()}`);
    expect(query).to.match(matcher);
    done();
  });
});

describe('updateOne', () => {

  it('can update a row', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.updateOne({ id: 0 }, { user_name: 'test_user' });
    expect(query).to.equal(`UPDATE "users" SET ("user_name") = ('test_user') WHERE "id" = 0 RETURNING ${db.users._formatColumns()}`);
    done();
  });

  it('can update a row without a query', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.updateOne(null, { user_name: 'test_user' });
    expect(query).to.equal(`UPDATE "users" SET ("user_name") = ('test_user') RETURNING ${db.users._formatColumns()}`);
    done();
  });
});

describe('scripts', () => {

  it('can run a script', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    const query = db.another_thing();
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });

  it('can run a script that returns a single result', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    const query = db.row();
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });

  it('can run a namespaced script', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    const query = db.users.random();
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });

  it('can run a namespaced script when the table has underscores', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    const query = db.with_underscores.row();
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });

  it('can run a namespaced script that returns a single result', (done) => {

    const db = new Muckraker(Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') }));
    const query = db.users.leader();
    expect(query).to.equal('SELECT * FROM "users"');
    done();
  });
});

describe('routines', () => {

  it('can run a routine', (done) => {

    const db = new Muckraker(internals);
    const query = db.something_random();
    expect(query.q).to.equal('something_random');
    done();
  });

  it('can run a scoped routine', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.self();
    expect(query.q).to.equal('users_self');
    done();
  });

  it('can run a scoped routine that returns a single result', (done) => {

    const db = new Muckraker(internals);
    const query = db.users.person();
    expect(query.q).to.equal('users_one_person');
    done();
  });
});
