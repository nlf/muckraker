'use strict';

const PG = require('pg-promise');

class MockPG {
  constructor(fail) {

    this.fail = fail;
  }

  query(q, p) {

    return PG.as.format(q instanceof PG.QueryFile ? q.query : q, p);
  }

  any(q, p) {

    return PG.as.format(q, p);
  }

  one(q, p) {

    return PG.as.format(q, p);
  }

  oneOrNone() {

    return this.one.apply(this, arguments);
  }

  none(q, p) {

    return PG.as.format(q, p);
  }

  func(q, params, mask) {

    return { q, params, mask };
  }

  task(fn) {

    if (this.fail) {
      return Promise.reject(new Error('Failed to connect'));
    }

    return fn({
      batch: function (results) {

        return Promise.all(results);
      },
      query: function (q) {

        switch (q) {
          case 'SELECT table_name,column_name,data_type,udt_name,column_default,is_nullable FROM information_schema.columns WHERE table_schema = \'public\'':
            return Promise.resolve([
              { table_name: 'users', column_name: 'id', data_type: 'uuid', column_default: 'uuid_generate_v4()', is_nullable: 'NO' },
              { table_name: 'users', column_name: 'user_name', data_type: 'text', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'blob', data_type: 'jsonb', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'json_blob', data_type: 'json', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'created', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'pets', data_type: 'integer', column_default: null, is_nullable: 'NO' },
              { table_name: 'users', column_name: 'pet_names', data_type: 'ARRAY', udt_name: '_text', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'unknown', data_type: 'something else', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'created_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'updated_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'deleted_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'id', data_type: 'integer', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'value', data_type: 'text', column_default: null, is_nullable: 'YES' },
              { table_name: 'with_underscores', column_name: 'id', data_type: 'integer', column_default: null, is_nullable: 'NO' }
            ]);
            break;
          case 'SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\'':
            return Promise.resolve([{ routine_name: 'users_self' }, { routine_name: 'something_random' }, { routine_name: 'one_item' }, { routine_name: 'users_one_person' }]);
            break;
          default:
            return Promise.reject(new Error(`Unknown query: ${q}`));
        };
      }
    });
  }
}

module.exports = MockPG;
