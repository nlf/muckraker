'use strict';

const PG = require('pg-promise');

class MockPG {
  query(q, params, mask) {

    switch (q) {
      case 'select * from "users"':
        if (mask === 5) {
          return Promise.resolve({ id: 0, user_name: 'test' });
        }
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      default:
        if (q instanceof PG.QueryFile) {
          return this.query(q.query, params, mask);
        }
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }

  any(q) {

    switch (q) {
      case 'select * from "users"':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      case 'select * from "users" where "id" = \'0\'':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      case 'update "users" set "user_name" = \'test_user\' where "id" = \'0\' returning *':
        return Promise.resolve([{ id: 0, user_name: 'test_user' }]);
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }

  one(q) {

    switch (q) {
      case 'select * from "users"':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'select * from "users" where "id" = \'0\'':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'insert into "users" ("id", "user_name") values (\'0\', \'test\') returning *':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'update "users" set "user_name" = \'test_user\' where "id" = \'0\' returning *':
        return Promise.resolve({ id: 0, user_name: 'test_user' });
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }

  none(q) {

    switch (q) {
      case 'delete from "users"':
        return Promise.resolve();
        break;
      case 'delete from "users" where "id" = \'0\'':
        return Promise.resolve();
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }

  func(q, params, mask) {

    switch (q) {
      case 'users_self':
      case 'something_random':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      case 'one_item':
      case 'users_one_person':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }

  task(fn) {

    return fn({
      batch: function (results) {

        return Promise.all(results);
      },
      query: function (q) {

        switch (q) {
          case 'SELECT table_name,column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema = \'public\'':
            return Promise.resolve([
              { table_name: 'users', column_name: 'id', data_type: 'uuid', column_default: 'uuid_generate_v4()', is_nullable: 'NO' },
              { table_name: 'users', column_name: 'user_name', data_type: 'text', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'blob', data_type: 'jsonb', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'created', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'users', column_name: 'pets', data_type: 'integer', column_default: null, is_nullable: 'NO' },
              { table_name: 'users', column_name: 'unknown', data_type: 'something else', column_default: null, is_nullable: 'YES' }
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
