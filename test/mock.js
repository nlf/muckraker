'use strict';

class MockPG {
  query(q) {

    switch (q) {
      case 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'':
        return Promise.resolve([{ table_name: 'users' }]);
        break;
      case 'SELECT routine_name FROM information_schema.routines WHERE routine_schema = \'public\'':
        return Promise.resolve([{ routine_name: 'users_self' }, { routine_name: 'something_random' }]);
        break;
      case 'select * from "users"':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      default:
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

  func(q) {

    switch (q) {
      case 'users_self':
        return Promise.resolve([{ id: 0, user_name: 'test' }]);
        break;
      default:
        return Promise.reject(new Error(`Unknown query: ${q}`));
    }
  }
}

module.exports = MockPG;
