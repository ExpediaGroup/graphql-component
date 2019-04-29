'use strict';

const Test = require('tape');
const { wrapResolvers, getImportedResolvers, memoize } = require('../lib/resolvers');

Test('wrapping', (t) => {

  t.test('wrap resolvers', (t) => {

    t.plan(1);

    const resolvers = {
      Query: {
        test() {
          return this.id;
        }
      }
    };

    const wrapped = wrapResolvers({ id: 1 }, resolvers);

    const value = wrapped.Query.test({}, {}, {}, { parentType: 'Query' });

    t.equal(value, 1, 'resolver was bound');
  });

  t.test('memoized resolvers', (t) => {

    t.plan(2);

    let ran = 0;

    const resolvers = {
      Query: {
        test() {
          ran += 1;
          return ran;
        }
      }
    };

    const wrapped = wrapResolvers(undefined, resolvers);

    const ctx = {};
    const info = { parentType: 'Query' };

    let value = wrapped.Query.test({}, {}, ctx, info);

    t.equal(value, 1, 'expected value');

    value = wrapped.Query.test({}, {}, ctx, info);

    t.equal(value, 1, 'same value, only ran resolver once');
  });

});

Test('imports', (t) => {

  t.test('get imported resolvers', (t) => {

    t.plan(2);

    const imp = {
      resolvers: {
        Query: {
          test() {
            return true;
          }
        }
      },
      importedResolvers: {
        Query: {
          imported() {
            return true;
          }
        }
      }
    };

    const imported = getImportedResolvers(imp);

    t.ok(imported.Query.test, 'resolver present');
    t.ok(imported.Query.imported, 'transitive resolver present');
  });

});

Test('memoize resolver', (t) => {

  t.test('memoized', (t) => {
    t.plan(2);

    let ran = 0;

    const resolver = function () {
      ran += 1;
      return ran;
    };

    const wrapped = memoize('Query', 'test', resolver);

    const ctx = {};

    let value = wrapped({}, {}, ctx);

    t.equal(value, 1, 'expected value');

    value = wrapped({}, {}, ctx);

    t.equal(value, 1, 'same value, only ran resolver once');
  });

  t.test('miss on different context', (t) => {
    t.plan(3);

    let ran = 0;

    const resolver = function () {
      ran += 1;
      return ran;
    };

    const wrapped = memoize('Query', 'test', resolver);

    const ctx = {};

    let value = wrapped({}, {}, ctx);

    t.equal(value, 1, 'expected value');

    value = wrapped({}, {}, ctx);

    t.equal(value, 1, 'same value, only ran resolver once');

    value = wrapped({}, {}, {});

    t.equal(value, 2, 'different value, different context');
  });

});
