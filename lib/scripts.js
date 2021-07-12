'use strict'

const assert = require('assert')
const fm = require('front-matter')
const fs = require('fs')
const keyfob = require('keyfob')
const path = require('path')
const pgp = require('pg-promise')

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
      assert(Object.prototype.hasOwnProperty.call(pgp.queryResult, mask), `Script at ${path} specified invalid return type "${mask}`)
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
        assert(Object.prototype.hasOwnProperty.call(pgp.txMode.isolationLevel, script.transaction.isolation), `Script at ${path} specified invalid transaction isolation level "${script.transaction.isolation}"`)
      }
      script.transaction.mode = new pgp.txMode.TransactionMode({
        tiLevel: script.transaction.isolation,
        readOnly: script.transaction.readOnly,
        deferrable: script.transaction.deferrable
      })

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

  const sql = keyfob.load({
    root,
    patterns: ['*.sql', '**/*.sql'],
    fn: (scriptPath) => {
      const contents = fs.readFileSync(scriptPath, { encoding: 'utf8' })
      const parsed = fm(contents)
      return validate(scriptPath, Object.assign(parsed.attributes, { query: parsed.body.trim() }))
    }
  })

  const js = keyfob.load({
    root,
    patterns: ['*.js', '**/*.js'],
    fn: (scriptPath) => {
      const script = require(scriptPath)
      return validate(scriptPath, script)
    }
  })

  const clean = (obj) => {
    for (const key in obj) {
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key]
      } else if (typeof obj[key].execute === 'function') {
        db[obj[key].name] = obj[key].execute
        delete obj[key]
      }
    }
    return obj
  }

  const result = clean(sql)
  for (const key in clean(js)) {
    Object.assign(result[key], js[key])
  }

  return result
}
