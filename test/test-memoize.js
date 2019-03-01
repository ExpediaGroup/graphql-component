
const Test = require('tape');
const { memoize } = require('../lib/memoize');


Test('memoize resolver', (t) => {

  t.test('memoized', (t) => {
    t.plan(2);

    let ran = 0;

    const resolver = function () {
      ran += 1;
      return ran;
    };

    const wrapped = memoize('test', resolver);

    const ctx = {};
    const info = { parentType: 'Query' };
    
    let value = wrapped({}, {}, ctx, info);
    
    t.equal(value, 1, 'expected value');

    value = wrapped({}, {}, ctx, info);
    
    t.equal(value, 1, 'same value, only ran resolver once');
  });

  t.test('miss on different context', (t) => {
    t.plan(3);

    let ran = 0;

    const resolver = function () {
      ran += 1;
      return ran;
    };

    const wrapped = memoize('test', resolver);

    const ctx = {};
    const info = { parentType: 'Query' };
    
    let value = wrapped({}, {}, ctx, info);
    
    t.equal(value, 1, 'expected value');

    value = wrapped({}, {}, ctx, info);
    
    t.equal(value, 1, 'same value, only ran resolver once');

    value = wrapped({}, {}, {}, info);
    
    t.equal(value, 2, 'different value, different context');
  });

});