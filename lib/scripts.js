'use strict'

const assert = require('assert')
const fs = require('fs')
const keyfob = require('keyfob')
const path = require('path')
const pgp = require('pg-promise')
const yaml = require('js-yaml')

const symValidated = Symbol('validated')

exports.load = function (db, root) {
  try {
    const stat = fs.statSync(root)
    if (!stat.isDirectory()) {
      return {}
    }
  } catch (err) {
    return {}
  }

  const validate = function (scriptPath, script) {
    if (script[symValidated]) {
      return script
    }

    if (!script.name) {
      script.name = path.basename(scriptPath, scriptPath.endsWith('.sql') ? '.sql' : '.js')
    }

    if (!script.returns) {
      script.returns = 'any'
    }

    script.returns = script.returns.split('||').map(mask => mask.trim()).reduce((final, mask) => {
      assert(pgp.queryResult.hasOwnProperty(mask), `Script at ${path} specified invalid return type "${mask}`)
      return final + pgp.queryResult[mask]
    }, 0)

    if (script.transaction) {
      if (typeof script.transaction !== 'object') {
        script.transaction = {}
      }

      if (!script.transaction.tag) {
        script.transaction.tag = script.name
      }

      if (script.transaction.isolation) {
        assert(pgp.txMode.isolationLevel.hasOwnProperty(script.transaction.isolation), `Script at ${path} specified invalid transaction isolation level "${script.transaction.isolation}"`)
      }
      script.transaction.mode = new pgp.txMode.TransactionMode(script.transaction.isolation, script.transaction.readOnly, script.transaction.deferrable)

      script.transaction.options = {
        tag: script.transaction.tag,
        mode: script.transaction.mode
      }

      if (typeof script.execute === 'function') {
        const userFn = script.execute
        script.execute = (arg) => {
          return db.tx(script.transaction.options, (d) => userFn(d, arg))
        }
      } else {
        assert(typeof script.query === 'string', `Script at ${path} must specify a "query" property`)
        script.execute = (arg) => {
          return db.tx(script.transaction.options, (d) => d.query(script.query, arg, script.returns))
        }
      }

      script[symValidated] = true
      return script
    }

    if (typeof script.execute === 'function') {
      const userFn = script.execute
      script.execute = (arg) => {
        return db.task(script.name, (d) => userFn(d, arg))
      }
    } else {
      assert(typeof script.query === 'string', `Script at ${path} must specify a "query" property`)
      script.execute = (arg) => {
        return db.task(script.name, (d) => d.query(script.query, arg, script.returns))
      }
    }

    script[symValidated] = true
    return script
  }

  const sql = keyfob.load({ path: root, includes: ['*.sql', '**/*.sql'], fn: (scriptPath) => {
    const contents = fs.readFileSync(scriptPath, { encoding: 'utf8' })
    const parsed = yaml.safeLoadAll(contents)
    const query = parsed.pop()
    const script = { query }

    if (parsed.length === 0) {
      return validate(scriptPath, script)
    }

    const options = parsed[0]
    return validate(scriptPath, Object.assign(options, script))
  }})

  const js = keyfob.load({ path: root, includes: ['*.js', '**/*.js'], fn: (scriptPath) => {
    const script = require(scriptPath)
    return validate(scriptPath, script)
  }})

  const clean = (obj) => {
    for (const key in obj) {
      if (obj[key]) {
        if (Object.keys(obj[key]).length === 0) {
          delete obj[key]
        } else if (typeof obj[key].execute === 'function') {
          db[obj[key].name] = obj[key].execute
          delete obj[key]
        }
      }
    }
    return obj
  }

  const result = clean(sql)
  for (const key in clean(js)) {
    Object.assign(result[key], sql[key])
  }

  return result
}
