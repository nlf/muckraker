'use strict';

const PG = require('pg-promise');

class MockPG {
  query(q, params, mask) {

    switch (q) {
      case 'SELECT * FROM "users"':
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

  any(q, p) {

    const query = PG.as.format(q, p);
    switch (query) {
      case 'SELECT * FROM "users"':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      case 'SELECT * FROM "users" WHERE "id"=0':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      case 'UPDATE "users" SET ("user_name", "blob") = (\'test_user\', \'{"another":"thing"}\') WHERE "id"=0 AND "blob"=\'{"some":"thing"}\' RETURNING *':
        return Promise.resolve([{ id: 0, user_name: 'test_user' }]);
        break;
      case 'UPDATE "users" SET ("user_name") = (\'test_user\') RETURNING *':
        return Promise.resolve([{ id: 0, user_name: 'test_user' }]);
        break;
      case 'SELECT * FROM "users" WHERE "blob"=\'{"test":"object"}\'':
        return Promise.resolve([{ id: 0, user_name: 'test_user' }]);
        break;
      default:
        const update = /^UPDATE "entries" SET \("value", "updated_at"\) = \('different test', '([^\)]+)'\) WHERE "value"='test' RETURNING \*$/.exec(query);
        if (update) {
          return Promise.resolve([{ value: 'different test', updated_at: new Date(update[1]) }]);
        }
        return Promise.reject(new Error(`Unknown query: ${query}`));
    }
  }

  one(q, p) {

    const query = PG.as.format(q, p);
    switch (query) {
      case 'SELECT * FROM "users"':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'SELECT * FROM "users" WHERE "id"=0':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'INSERT INTO "users" ("id", "user_name", "blob") VALUES (0, \'test\', \'{"some":"data"}\') RETURNING *':
        return Promise.resolve({ id: 0, user_name: 'test' });
        break;
      case 'UPDATE "users" SET ("user_name") = (\'test_user\') WHERE "id"=0 RETURNING *':
        return Promise.resolve({ id: 0, user_name: 'test_user' });
        break;
      case 'UPDATE "users" SET ("user_name") = (\'test_user\') RETURNING *':
        return Promise.resolve({ id: 0, user_name: 'test_user' });
        break;
      default:
        const insert = /^INSERT INTO "entries" \("value", "created_at", "updated_at"\) VALUES \('test', '([^\)]+)', '([^\)]+)'\) RETURNING \*$/.exec(query);
        if (insert) {
          return Promise.resolve({ value: 'test', created_at: new Date(insert[1]), updated_at: new Date(insert[2]) });
        }
        return Promise.reject(new Error(`Unknown query: ${query}`));
    }
  }

  oneOrNone() {

    return this.one.apply(this, arguments);
  }

  none(q, p) {

    const query = PG.as.format(q, p);
    switch (query) {
      case 'DELETE FROM "users"':
        return Promise.resolve();
        break;
      case 'DELETE FROM "users" WHERE "id"=0':
        return Promise.resolve();
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${query}`));
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
              { table_name: 'users', column_name: 'unknown', data_type: 'something else', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'created_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'updated_at', data_type: 'timestamp with time zone', column_default: null, is_nullable: 'YES' },
              { table_name: 'entries', column_name: 'value', data_type: 'text', column_default: null, is_nullable: 'YES' }
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
