'use strict';

const Test = require('tape');
const { intercept } = require('../lib/provider');
const GraphQLComponent = require('../lib/index');

Test('provider', (t) => {

  t.test('intercept proxy', (t) => {
    t.plan(3);

    const proxy = intercept(new class Provider {
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    }, {
      data: 'test'
    });

    proxy.test('test');
  });

});