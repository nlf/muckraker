'use strict'

exports.execute = async function feedUser (db, arg) {
  return db.users.find()
}
