# Muckraker

Muckraker is a wrapper around the [pg-promise](https://github.com/vitaly-t/pg-promise) library to provide some simple, easily extensable, functionality out of the box.

## `new Muckraker(options)`

The `options` object may contain the following:

- `connection`: Postgres configuration object passed through directly to the `pg` library.
- `pg`: Configuration passed directly to the `pg-promise` library.
- `scriptDir`: Path to the directory containing all of your `.sql` and `.js` scripts. More on this [below](#scripts).
- `timestamps`: Configuration for the timestamp columns. More on this [below](#automatic-timestamps).
- `encrypt`: Encryption options. More on this [below](#encryption).

### `muckraker.query()`

Execute a query on the root level database. Arguments passed to this method are passed directly to pg-promise's [query method](http://vitaly-t.github.io/pg-promise/Database.html#query)

### `muckraker.task(tag, fn)`

Acquire a database connection with a given (optional) tag then run the passed in function `fn` passing the database connection as the first parameter. The connection will be a clone of the root database object, containing the same table and script methods.

### `muckraker.tx(options, fn)`

Acquire a database connection and begin a transaction, then run the passed in function `fn` passing the database connection as the first parameter. The connection will be a clone of the root database object, containing the same table and script methods. After the passed in `fn` completes, the transaction will either be committed or aborted depending on if your function throws an error.

The options available are:
- `tag`: Similar to the `task` method, used for identification purposes.
- `mode`: A [TransactionMode](http://vitaly-t.github.io/pg-promise/txMode.TransactionMode.html) object, used to configure the transaction's behavior.

## Tables

In addition to the top level methods, muckraker will create a table object for each table in your database and attach it to the top level object. For example, if you have a database named `users` and another table named `profiles`, your root database object (`db`) will have table objects at `db.users` and `db.profiles`.

### Query building

Query parameters for each table method are passed as an object. This object may contain any properties you like, though any top level keys that do not match a column in the active table will be ignored. Each property that matches a valid column will add a clause to the `WHERE` portion of a query.

The default comparison, used for any value which is not an object, is `=` (equals). Other operators are supported by using an object with the matching key, such as `db.users.find({ column: { $ne: 'test' } })`. Currently available operators are:

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

Multiple properties passed together are joined with `AND` statements.

#### JSON/JSONB columns

In addition to the above simple queries, a deeper object may be passed representing an operation on a property within a `json` or `jsonb` column. For example:

```javascript
db.users.find({ preferences: { some: { really: { deep: { property: { $ne: null } } } } } })
```

Would yield a query similar to `SELECT * FROM "users" WHERE "preferences"#>>'{some,really,deep,property}' IS NOT NULL`

#### Result columns

Each table method, with the exception of `destroy`, accepts a final parameter `columns`. This parameter is optional and should be an array of column names you wish to have returned. By default, every column in the table that is _not_ encrypted will be returned.

In order to receive encrypted values you _must_ specify the `columns` parameter and include the name of the encrypted column.

In addition, you may return a child property of a `json` or `jsonb` column by passing an array to this property representing the path to the key. For example:

```javascript
table.find({ public: true }, ['id', ['a-json-column', 'and', 'its', 'key']])
```

Would return an array of objects with two properties `id` and `key` (named for the final property in the json path chain).

#### Automatic timestamps

Muckraker will attempt to automatically update known columns for created, updated and deleted timestamps.

These column names default to `created_at`, `updated_at`, and `deleted_at`. You may change these options both globally as well as specifying them on a per-table basis when initializing the database object. For example:

```javascript
const db = new Muckraker({
  timestamps: {
    created: 'created_at', // global defaults
    updated: 'updated_at',
    deleted: 'deleted_at',
    users: {
      created: 'created', // overrides for only the "users" table
      updated: 'updated',
      deleted: 'deleted'
    }
  }
})
```

When using the `insert()` method, both the created and updated timestamps will be set to the current time by default. If you manually specify a value for either as part of your data object that value will take precedence.

When using the `update()` or `updateOne()` methods, the updated timestamp will be set to the current time. Again, if a value for the column is specified it will take precedence.

The deleted timestamp is used to implement soft deletes. By default every query will specify a `WHERE deleted_at IS NULL` clause. This can be overridden by manually specifying an operator for the column, such as `table.find({ deleted_at: { $ne: null } })`. If the deleted column exists, the `destroy()` method will default to populating the column with the current timestamp instead of actually deleting the row. If you wish to forcefully delete, even when typically using soft deletes, you may pass the object `{ force: true }` as the second parameter to the `destroy()` method. For example: `table.destroy({ id: 0 }, { force: true })`.

#### Encryption

Muckraker has some basic support for encryption via the `pgcrypto` extension and its `pgp_sym_encrypt` and `pgp_sym_decrypt` methods. To use it, you must inform muckraker about what columns are encrypted:

```javascript
const db = new Muckraker({
  encrypt: {
    'users.secret': { key: 'some_secret_key' }
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

The default cipher of `aes256` may be overridden globally by passing a `cipher` property in the options, as well as per-column by passing it next to the `key` property:

```javascript
const db = new Muckraker({
  encrypt: {
    'users.secret': { key: 'some_secret_key' }, // uses the default cipher
    'users.extraSecret': { cipher: 'aes512', key: 'another_secret_key' }, // uses its own cipher
    cipher: 'aes192' // default
  },
});
```

### `table.find(params, columns)`

Perform a `SELECT` query returning any number of rows.

### `table.findOne(params, columns)`

Perform a `SELECT` query returning either exactly one row, or `null`.

### `table.insert(data, columns)`

Perform an `INSERT` using the given data.

### `table.destroy(params, options)`

Perform a `DELETE`. The `options` object may specify a `force` boolean, which when `true` will perform a hard delete even when a timestamp column representing soft deletes exists.

### `table.update(params, data, columns)`

Perform an `UPDATE` query matching any number of rows using `params` as the `WHERE` and `data` as the new values.

### `table.updateOne(params, data, columns)`

Perform an `UPDATE` query matching either exactly one row, or none using `params` as the `WHERE` and `data` as the new values.

## Scripts

Sometimes writing long queries can be cumbersome, so muckraker can also load queries from both `*.sql` and `*.js` files. By default, these files will be loaded recursively from a directory named `db` in the current working directory at initialization time. You may override this by using the `scriptDir` property passed to the `Muckraker` constructor.

Script files may be located either directly in the `db` directory, which will yield in functions being attached directly to the root database instance, or contained within a directory with a name matching a table which will attach the function to the corresponding table object instead. Scripts contained in directories that do not match a table will be ignored.

When using `*.sql` files, you may use yaml frontmatter to specify some additional configuration items while `*.js` files provide this configuration via properties in an exported object.

A `*.sql` file that returns either exactly one row or `null` might look like:

```
---
name: myFunction
returns: one || none
---

SELECT * FROM "users" WHERE id = $[id]
```

While the corresponding `*.js` file could look like:

```javascript
exports.name = 'myFunction'
exports.returns = 'one || none'
exports.query = 'SELECT * FROM "users" WHERE id = $[id]'
// this query could also be defined as a function like so
/*
exports.execute = function (db, { id }) {
  return db.users.findOne({ id })
}
*/
```

Each script may specify:
- `name`: A string used to name a given function. If not specified, this defaults to the filename of the script.
- `returns`: A string describing the number of rows this query is intended to return. Available values are `one`, `many`, `none`, and `any`. Multiple values can be appended using the characters `||`, for example `one || none`. The meaning of each of these values can be found in the [pg-promise docs](http://vitaly-t.github.io/pg-promise/global.html#queryResult)
- `transaction`: An object describing transaction options. This may also be the value `true` to provide a simple transaction. Available properties on this key are:
  - `tag`: For identification, defaults to the same value as `name`.
  - `isolation`: Specify isolation level, see [here](http://vitaly-t.github.io/pg-promise/txMode.html#.isolationLevel) for possible values to be passed as a string.
  - `readOnly`: A boolean, when `true` specifies the transaction to be `READ ONLY`.
  - `deferrable`: A boolean, when `true` specifies the transaction to be `DEFERRABLE`.

As well as *one* of the following (note that `*.sql` files pass text after the frontmatter as an implicit `query` property):
- `execute`: A function to be run. This will be passed exactly two arguments, the first being an instance of the `db`, the second being user specified input.
- `query`: A string SQL query following the conventions of [pg-promise queries](http://vitaly-t.github.io/pg-promise/formatting.html#.format)
