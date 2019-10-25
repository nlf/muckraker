'use strict'

const Mock = require('./mock')
const Path = require('path')

const internals = {
  connect: {
    host: 'localhost'
  },
  _mocked: new Mock()
}

exports.getOptions = function ({ skipScripts = false, connectionFail = false } = {}) {
  if (connectionFail) {
    return { _mocked: new Mock(true) }
  }

  if (skipScripts) {
    return internals
  }

  return Object.assign({}, internals, { scriptDir: Path.join(__dirname, 'db') })
}
