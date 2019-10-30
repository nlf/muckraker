'use strict'

exports.transaction = {
  tag: 'something-complex',
  isolation: 'serializable'
}

exports.execute = (db) => db.users.find()

