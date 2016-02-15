'use strict';

const Muckraker = require('../');
const Database = require('../lib/database');
const Mock = require('./mock');
const Path = require('path');

const lab = exports.lab = require('lab').script();
const expect = require('code').expect;
const it = lab.test;
const describe = lab.experiment;

const internals = {
  connection: {
    host: 'localhost'
  }
};

describe('constructor', () => {

  it('can create an instance of Muckraker', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    expect(mr).to.exist();
    expect(mr).to.be.an.instanceof(Muckraker);
    done();
  });

  it('can create an instance of Muckraker while specifying a different scriptDir', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    expect(mr).to.exist();
    expect(mr).to.be.an.instanceof(Muckraker);
    done();
  });
});

describe('connect', () => {

  it('can connect and return an instance of Database', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      expect(db).to.exist();
      expect(db).to.be.an.instanceof(Database);
      done();
    }).catch(done);
  });
});

describe('query', () => {

  it('can send a raw query', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.query('SELECT * FROM "users"');
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });
});

describe('find', () => {

  it('can find rows in a table', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });

  it('adds a filter for tables with a deleted_at column', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.find();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "entries" WHERE "deleted_at" IS NULL');
      done();
    }).catch(done);
  });

  it('allows overriding the default filter for tables with a deleted_at column', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.find({ deleted_at: { $ne: null } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "entries" WHERE "deleted_at" IS NOT NULL');
      done();
    }).catch(done);
  });

  it('allows overriding the default filter for tables with a deleted_at column by passing a date', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.find({ deleted_at: new Date() });
    }).then((query) => {

      expect(query).to.match(/SELECT \* FROM "entries" WHERE "deleted_at" = '([^']+)'$/);
      done();
    }).catch(done);
  });

  it('can find rows in a table with a condition', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ id: 0, invalid: 'key' });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "id" = 0');
      done();
    }).catch(done);
  });

  it('can find rows in a table with a condition in a json column', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ blob: { test: 'object' } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "blob" = \'{"test":"object"}\'');
      done();
    }).catch(done);
  });

  it('can find rows in a table with a column that is null', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ unknown: null });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "unknown" IS NULL');
      done();
    }).catch(done);
  });

  it('can find rows in a table with a column that is explicitly null', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ unknown: { $eq: null } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "unknown" IS NULL');
      done();
    }).catch(done);
  });

  it('can find rows in a table with a column that is not null', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ unknown: { $ne: null } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "unknown" IS NOT NULL');
      done();
    }).catch(done);
  });

  it('can use the $gt operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $gt: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" > 1');
      done();
    }).catch(done);
  });

  it('can use the $gte operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $gte: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" >= 1');
      done();
    }).catch(done);
  });

  it('can use the $lt operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $lt: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" < 1');
      done();
    }).catch(done);
  });

  it('can use the $lte operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $lte: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" <= 1');
      done();
    }).catch(done);
  });

  it('can use the $ne operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $ne: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" != 1');
      done();
    }).catch(done);
  });

  it('can use the $eq operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $eq: 1 } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" = 1');
      done();
    }).catch(done);
  });

  it('can use the $in operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ pets: { $in: [1, 2, 3] } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "pets" IN (1,2,3)');
      done();
    }).catch(done);
  });

  it('can use the $like operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ user_name: { $like: 'test' } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "user_name" LIKE \'test\'');
      done();
    }).catch(done);
  });

  it('can use the $nlike operator', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.find({ user_name: { $nlike: 'test' } });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "user_name" NOT LIKE \'test\'');
      done();
    }).catch(done);
  });
});

describe('findOne', () => {

  it('can find a single row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.findOne();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });

  it('can find a single row with a condition', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.findOne({ id: 0 });
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users" WHERE "id" = 0');
      done();
    }).catch(done);
  });
});

describe('insert', () => {

  it('can insert a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.insert({ id: 0, invalid: 'key', user_name: 'test', blob: { some: 'data' } });
    }).then((query) => {

      expect(query).to.equal('INSERT INTO "users" ("id", "user_name", "blob") VALUES (0, \'test\', \'{"some":"data"}\') RETURNING *');
      done();
    }).catch(done);
  });

  it('can set created_at and updated_at implicitly when creating a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.insert({ value: 'test' });
    }).then((query) => {

      expect(query).to.match(/^INSERT INTO "entries" \("value", "created_at", "updated_at"\) VALUES \('test', '([^\)]+)', '([^\)]+)'\) RETURNING \*$/);
      done();
    }).catch(done);
  });
});

describe('destroy', () => {

  it('can delete a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.destroy();
    }).then((query) => {

      expect(query).to.equal('DELETE FROM "users"');
      done();
    }).catch(done);
  });

  it('can delete a row with a condition', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.destroy({ id: 0 });
    }).then((query) => {

      expect(query).to.equal('DELETE FROM "users" WHERE "id" = 0');
      done();
    }).catch(done);
  });

  it('can soft delete a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.destroy({ id: 0 });
    }).then((query) => {

      expect(query).to.match(/UPDATE "entries" SET \("deleted_at"\) VALUES \('([^\)]+)'\) WHERE "id" = 0/);
      done();
    }).catch(done);
  });
});

describe('update', () => {

  it('can update a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.update({ id: 0, invalid: 'key', blob: { some: 'thing' } }, { user_name: 'test_user', invalid: 'key', blob: { another: 'thing' } });
    }).then((query) => {

      expect(query).to.equal('UPDATE "users" SET ("user_name", "blob") = (\'test_user\', \'{"another":"thing"}\') WHERE "id" = 0 AND "blob" = \'{"some":"thing"}\' RETURNING *');
      done();
    }).catch(done);
  });

  it('can update a row without a query', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.update(null, { user_name: 'test_user' });
    }).then((query) => {

      expect(query).to.equal('UPDATE "users" SET ("user_name") = (\'test_user\') RETURNING *');
      done();
    }).catch(done);
  });

  it('can set the updated_at column implicitly if it exists', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.entries.update({ value: 'test' }, { value: 'different test' });
    }).then((query) => {

      expect(query).to.match(/^UPDATE "entries" SET \("value", "updated_at"\) = \('different test', '([^\)]+)'\) WHERE "value" = 'test' AND "deleted_at" IS NULL RETURNING \*$/);
      done();
    }).catch(done);
  });
});

describe('updateOne', () => {

  it('can update a row', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.updateOne({ id: 0 }, { user_name: 'test_user' });
    }).then((query) => {

      expect(query).to.equal('UPDATE "users" SET ("user_name") = (\'test_user\') WHERE "id" = 0 RETURNING *');
      done();
    }).catch(done);
  });

  it('can update a row without a query', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.updateOne(null, { user_name: 'test_user' });
    }).then((query) => {

      expect(query).to.equal('UPDATE "users" SET ("user_name") = (\'test_user\') RETURNING *');
      done();
    }).catch(done);
  });
});

describe('scripts', () => {

  it('can run a script', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.another_thing();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });

  it('can run a script that returns a single result', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.row();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });

  it('can run a namespaced script', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.random();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });

  it('can run a namespaced script that returns a single result', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.leader();
    }).then((query) => {

      expect(query).to.equal('SELECT * FROM "users"');
      done();
    }).catch(done);
  });
});

describe('routines', () => {

  it('can run a routine', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.something_random();
    }).then((query) => {

      expect(query.q).to.equal('something_random');
      done();
    }).catch(done);
  });

  it('can run a scoped routine', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.self();
    }).then((query) => {

      expect(query.q).to.equal('users_self');
      done();
    }).catch(done);
  });

  it('can run a scoped routine that returns a single result', (done) => {

    const mr = new Muckraker({
      connection: internals.connection,
      scriptDir: Path.join(__dirname, 'db')
    });

    mr.db = new Mock();
    mr.connect().then((db) => {

      return db.users.person();
    }).then((query) => {

      expect(query.q).to.equal('users_one_person');
      done();
    }).catch(done);
  });
});
