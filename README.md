# Muckraker

Muckraker is a thin wrapper around the [pg-promise](https://github.com/vitaly-t/pg-promise) library to provide some common methods in a simple way.

It will inspect your tables when connecting and provide a few simple CRUD methods for each within a namespace.

```javascript
'use strict';

// in this example a 'users' table exists

const Muckraker = require('muckraker');
const mr = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

mr.connect().then((db) => {

  // the 'db' object will now have a 'users' property corresponding to the existing table
  // db.users.find(q) return an array of users, optionally passing 'q' as a WHERE clause
  // db.users.findOne(q) returns a single user, again optionally passing 'q'
  // db.users.insert(data) inserts the data into the users table and returns the inserted row
  // db.users.update(q, data) updates rows matching q with data and returns an array of all modified rows
  // db.users.updateOne(q, data) updates rows matching q with data and returns a single modified row
  // db.users.destroy(q) deletes rows, optionally passing 'q' as a WHERE clause (this method returns no results)
});
```

Additionally, muckraker will enumerate any stored functions you have and attach them to the database object namespacing those that match an existing table

```javascript
'use strict';

// in this example a 'users' table exists, as well as two stored functions
// one named 'users_self' and one named 'do_something'
// since 'users_self' begins with 'users_' and 'users' corresponds to a table, the function
// will be attached as a property of the db.users object with the 'users_' prefix removed

const Muckraker = require('muckraker');
const mr = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

mr.connect().then((db) => {

  // db.users.self() will run the 'users_self' function passing all arguments to the method as an array
  // db.do_something() will run the 'do_something' function, again passing arguments as an array to the function
});
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
const mr = new Muckraker({
  connection: { // passes through to the pg library
    host: 'localhost',
    database: 'my_app'
  }
});

mr.connect().then((db) => {

  // db.users.self() will run the contents of the 'users_self.sql' file passing all arguments to the method as an array
  // db.do_something() will run the contents of the 'do_something.sql' file, again passing arguments as an array
});
```


### Special thanks to [arb](https://github.com/arb) for coming up with the name
