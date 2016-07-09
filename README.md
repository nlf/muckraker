# Muckraker

Muckraker is a thin wrapper around the [pg-promise](https://github.com/vitaly-t/pg-promise) library to provide some common methods in a simple way.

It will inspect your tables when instantiated and provide a few simple CRUD methods for each within a namespace.

```javascript
'use strict';

// in this example a 'users' table exists

const Muckraker = require('muckraker');
const db = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

// the 'db' object will now have a 'users' property corresponding to the existing table
// db.users.find(q) return an array of users, optionally passing 'q' as a WHERE clause
// db.users.findOne(q) returns a single user, again optionally passing 'q'
// db.users.insert(data) inserts the data into the users table and returns the inserted row
// db.users.update(q, data) updates rows matching q with data and returns an array of all modified rows
// db.users.updateOne(q, data) updates rows matching q with data and returns a single modified row
// db.users.destroy(q, options) deletes rows, optionally passing 'q' as a WHERE clause (this method returns no results)
```

All of the above functions, except for destroy, also accept a final parameter as an array of column names that you want returned

```javascript
db.users.find({}, ['id']); // list all users and only return the id column
```

If you want to return a property or sub property of a json or jsonb column directly, specify its key as an array with the first item being the name of the column and the rest being the path to the final key. The result will be named after the final key in the array:

```javascript
db.users.find({}, ['name', ['json_column', 'some', 'deep', 'path']]);
// this yields: SELECT "name","json_column"#>>'{some,deep,path}' AS "path" FROM "users"
```

Additionally, muckraker will enumerate any stored functions you have and attach them to the database object namespacing those that match an existing table

```javascript
'use strict';

// in this example a 'users' table exists, as well as two stored functions
// one named 'users_self' and one named 'do_something'
// since 'users_self' begins with 'users_' and 'users' corresponds to a table, the function
// will be attached as a property of the db.users object with the 'users_' prefix removed

const Muckraker = require('muckraker');
const db = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

// db.users.self() will run the 'users_self' function passing all arguments to the method as an array
// db.do_something() will run the 'do_something' function, again passing arguments as an array to the function
```

A stored function can also have a prefix of `'one_'` to inform muckraker that the function returns only a single row

```javascript
// with a routine named users_paid
db.users.paid() // returns an array
// with a routine named users_one_self
db.users.self() // returns a single object
// with a routine named process_payments
db.process_payments() // returns an array of results
// with a routine named one_random_row
db.random_row() // returns a single object
```

Sometimes writing long queries can be cumbersome, so muckraker can also load queries from text files and attach those to the database object much like stored functions. These file names will be parsed in the same fashion as stored functions, allowing for table name and `'one_'` prefixes

```javascript
'use strict';

// in this example a 'users' table exists, as well as a physical directory named 'db'
// in that directory are two files, 'users_self.sql' and 'do_something.sql'
// again, since 'users_self' has a prefix matching an existing table, it will be attached
// as a property on the users object
// the location of the directory scanned for these scripts defaults to being a 'db' directory in the current working directory
// it can be configured by passing a 'scriptDir' parameter when creating your instance of Muckraker

const Muckraker = require('muckraker');
const db = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

// db.users.self() will run the contents of the 'users_self.sql' file passing all arguments to the method as an array
// db.do_something() will run the contents of the 'do_something.sql' file, again passing arguments as an array
```

The default comparison for all properties is `=` (equals). Other operators are supported by using an object with the matching key, such as `db.users.find({ column: { $ne: 'test' } })`. Currently available operators are:

- `$eq` for `=`
- `$ne` for `!=`
- `$lt` for `<`
- `$lte` for `<=`
- `$gt` for `>`
- `$gte` for `>=`
- `$in` for `IN`
- `$nin` for `NOT IN`
- `$like` for `LIKE`
- `$nlike` for `NOT LIKE`

JSON columns will be automatically resolved to allow deep querying, for example:

```js

// in this example the 'users' table has a 'preferences' column defined as being the 'jsonb' type

const Muckraker = require('muckraker');
const db = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

db.users.find({ preferences: { sendEmails: true } });
// the above would yield: 'SELECT * FROM "users" WHERE "preferences"#>>'{sendEmails}' = 'true'

// the keys can be as deep as you like
db.users.find({ preferences: { some: { really: { deep: { property: { $ne: null } } } } } });
// this would yield: 'SELECT * FROM "users" WHERE "preferences"#>>'{some,really,deep,property}' IS NOT NULL'
```

## Transactions

Transactions are supported with `db.tx(callback)` - the callback will be passed an instance of the db which should be used for making queries on the transaction. You should return a promise from the transaction - if it rejects, the transaction will be rolled back.

For example:

```js

const Muckraker = require('muckraker');
const db = new Muckraker(
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

db.tx((t) => {

  // t is an instance of the db, configured for the transaction
  // so you can use all the methods/tables on it that you would for db

  // return a promise to determine whether to commit/rollback the transaction
  // if either insert here fails, both would be rolled back
  return t.orgs.insert({ org_name: 'My Org' }).then((org) => {
    return t.users.insert({
      name: 'Phil',
      org_id: org.id
    })
  });
});
```


## Modification Dates

Muckraker also will attempt to automatically update `created_at` and `updated_at` fields for you when using insert and update/updateOne. When inserting both columns will be set to the current time (assuming the columns exist in your table), when updated the `updated_at` column will be set to the current time.

In addition to that, soft deletes are also available in the form of adding a `deleted_at` column to your table. When this is the case the `destroy()` method will set this column to the current time rather than actually removing the row. The various query methods are also adjusted to default to specifying `"deleted_at" IS NULL` as part of their conditions. You can pass a different value for the `deleted_at` column if you wish to see rows where this value is set, for example `db.users.find({ deleted_at: { $ne: null } })` would give you a list of deleted users.

If you want to hard delete a row that has a `deleted_at` column pass an options object with `force = true` to the destroy method, for example `db.users.destroy({ id: 0 }, { force: true })`.

## Encryption

Muckraker also has some basic support for encryption via the `pgcrypto` extension and its `pgp_sym_encrypt` and `pgp_sym_decrypt` methods. To use it, you must inform muckraker about what columns are encrypted:

```javascript
const db = new Muckraker({
  connection: {
    host: 'localhost',
    database: 'my_app'
  },
  encrypt: {
    'users.secret': 'some_secret_key'
  }
});
```

The above configuration tells muckraker that the `"secret"` column in the `"users"` table is encrypted. In order for this to work correctly, you must load the `pgcrypto` extension by running `CREATE EXTENSION "pgcrypto";`. You must also set the column type of the encrypted column to `BYTEA`.

Now when the `"secret"` column is written to, its value will be encrypted by postgres:

```javascript
db.users.insert({ name: 'test', secret: 'some super secret value' });
// writes the result of pgp_sym_encrypt('some super secret value', 'some_secret_key', 'cipher-algo=aes256') to the "secret" column
```

When performing queries, by default any encrypted columns are not returned. This is to help prevent accidentally leaking sensitive data. If you would like to return an encrypted column, pass an array of column names manually and muckraker will decrypt the value and return it for you:

```javascript
db.users.findOne({ name: 'test' }, ['name', 'secret']);
// returns { name: 'test', secret: 'some super secret value' }
```

The default cipher of `aes256` may be overridden by passing a `cipher` property in the options:

```javascript
const db = new Muckraker({
  connection: {
    host: 'localhost',
    database: 'my_app'
  },
  encrypt: {
    'users.secret': 'some_secret_key'
  },
  cipher: 'aes192'
});
```

## REPL

Also included is a repl, called `mr`. To use it run `./node_modules/.bin/mr` with either the name of your database (i.e. 'mydatabase') or a full postgres connection string (i.e. 'postgres://user:password@somehostname/databasename). The repl will automatically connect to your server for you, and provide a `db` variable that contains all of the above methods. Promises will be automatically resolved for you so you can simply run methods and see results.

```
Connected to mydatabase
muckraker> db.users.findOne({ id: 0 })
{ id: 0,
  user_name: 'test' }
muckraker> var me = db.users.self(); // you can also assign the results of these methods straight to a variable
```

### Special thanks to [arb](https://github.com/arb) for coming up with the name
