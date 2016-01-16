'use strict';

const Muckraker = require('../');

const lab = exports.lab = require('lab').script();
const expect = require('code').expect;
const it = lab.test;
const describe = lab.experiment;

const internals = {
  connection: {
    host: 'localhost'
  }
};

describe('constructor', () => {

  it('can create an instance of Muckraker', (done) => {

    const mr = new Muckraker({
      connection: internals.connection
    });

    expect(mr).to.exist();
    expect(mr).to.be.an.instanceof(Muckraker);
    done();
  });
});
