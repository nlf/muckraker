'use strict'

const PG = require('pg-promise')

class MockPG {
  constructor (fail) {
    this.fail = fail
    this.PG = PG
  }

  async query (q, p) {
    if (this.fail) {
      return Promise.reject(new Error('Failed to connect'))
    }

    if (q === `SELECT table_name,column_name,udt_name::regtype as data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = 'public'`) {
      return Promise.resolve([
        { table_name: 'users', column_name: 'id', data_type: 'uuid', column_default: 'uuid_generate_v4()', is_nullable: 'NO' },
        { table_name: 'users', column_name: 'user_name', data_type: 'text', column_default: null, is_nullable: 'YES' },
        { table_name: 'users', column_name: 'blob', data_type: 'jsonb', column_default: null, is_nullable: 'YES' },
        { table_name: 'users', column_name: 'json_blob', data_type: 'json', column_default: null, is_nullable: 'YES' },
        { table_name: 'users', column_name: 'created', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
        { table_name: 'users', column_name: 'pets', data_type: 'integer', column_default: null, is_nullable: 'NO' },
        { table_name: 'users', column_name: 'pet_names', data_type: 'text[]', column_default: null, is_nullable: 'YES' },
        { table_name: 'users', column_name: 'unknown', data_type: 'something else', column_default: null, is_nullable: 'YES' },
        { table_name: 'entries', column_name: 'created_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
        { table_name: 'entries', column_name: 'updated_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
        { table_name: 'entries', column_name: 'deleted_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
        { table_name: 'entries', column_name: 'id', data_type: 'integer', column_default: null, is_nullable: 'YES' },
        { table_name: 'entries', column_name: 'value', data_type: 'text', column_default: null, is_nullable: 'YES' },
        { table_name: 'with_underscores', column_name: 'id', data_type: 'integer', column_default: null, is_nullable: 'NO' }
      ])
    }

    return PG.as.format(q, p)
  }

  async any (q, p) {
    return PG.as.format(q, p)
  }

  async one (q, p) {
    return PG.as.format(q, p)
  }

  async oneOrNone () {
    return this.one.apply(this, arguments)
  }

  async none (q, p) {
    return PG.as.format(q, p)
  }

  async tx (opts, fn) {
    this._txopts = opts // Set so we can find it in tests
    return fn(this)
  }

  async task (tag, fn) {
    this._tag = tag
    return fn(this)
  }
}

module.exports = MockPG
