'use strict';

const internals = {
  knex: require('knex')({ dialect: 'pg' })
};

class Table {
  constructor(db, name) {

    this._db = db;
    this._name = name;
  }

  find(when) {

    const query = internals.knex(this._name).select().where(when || {});
    return this._db.any(query.toString());
  }

  findOne(when) {

    const query = internals.knex(this._name).select().where(when || {});
    return this._db.one(query.toString());
  }

  insert(data) {

    const query = internals.knex(this._name).insert(data).returning('*');
    return this._db.one(query.toString());
  }

  destroy(when) {

    const query = internals.knex(this._name).where({} || when).delete();
    return this._db.none(query.toString());
  }

  update(when, data) {

    const query = internals.knex(this._name).where(when).update(data, '*');
    return this._db.any(query.toString());
  }

  updateOne(when, data) {

    const query = internals.knex(this._name).where(when).update(data, '*');
    return this._db.one(query.toString());
  }
}

module.exports = Table;
