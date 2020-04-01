'use strict';

const Test = require('tape');
const { Kind } = require('graphql');
const { memoize, transformResolvers, wrapResolvers, getImportedResolvers, createProxyResolvers, createProxyResolver, createOperationForField } = require('../lib/resolvers');

Test('wrapping', (t) => {

  t.test('wrap resolver function', (t) => {

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

  t.test('wrap resolver mapped to primitive (enum remap)', (t) => {
    t.plan(1);

    const resolvers = {
      FooBarEnumType: {
        FOO: 1,
        BAR: 2
      }
    }

    const wrapped = wrapResolvers({id: 1}, resolvers);
    t.equal(wrapped.FooBarEnumType.FOO, 1, 'primitive resolver mapping wraps without error and returns primitive')
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
      _resolvers: {
        Query: {
          test() {
            return true;
          }
        }
      },
      _importedResolvers: {
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

  t.test('miss on different args', (t) => {
    t.plan(2);

    let ran = 0;

    const resolver = function () {
      ran += 1;
      return ran;
    };

    const wrapped = memoize('Query', 'test', resolver);

    const ctx = {};

    let value = wrapped({}, { foo: 1 }, ctx);

    t.equal(value, 1, 'expected value');

    value = wrapped({}, { foo: 2 }, ctx);

    t.equal(value, 2, 'different value');
  });

});

Test('transform', (t) => {

  t.test('exclude wildcard', (t) => {
    t.plan(2);

    const resolvers = {
      Query: {
        test: () => {}
      },
      Mutation: {
        test: () => {}
      }
    };

    const transformed = transformResolvers(resolvers, [['Mutation', '*']]);

    t.ok(transformed.Query && transformed.Query.test, 'query present');
    t.ok(!transformed.Mutation, 'mutation not present');

  });

});

Test('proxy resolvers', (t) => {

  t.test('get imported resolvers with proxy flag true', (t) => {

    t.plan(2);

    const imp = {
      _resolvers: {
        Query: {
          test() {
            return true;
          }
        }
      },
      _importedResolvers: {
        Query: {
          imported() {
            return true;
          }
        }
      }
    };

    const imported = getImportedResolvers(imp, true);

    t.ok(imported.Query.test.__isProxy, 'resolver is proxy');
    t.ok(!imported.Query.imported.__isProxy, 'transitive resolver is not proxy');
  });

  t.test('get imported resolvers with proxy flag false', (t) => {

    t.plan(1);

    const imp = {
      _resolvers: {
        Query: {
          test() {
            return true;
          }
        }
      }
    };

    const imported = getImportedResolvers(imp, false);

    t.ok(!imported.Query.test.__isProxy, 'resolver is not proxy');
  });

  t.test('createProxyResolver', (t) => {
    t.plan(1);

    const resolver = createProxyResolver(undefined, 'Query', 'test');

    t.strictEqual(resolver.__isProxy, true, 'function created is a proxy');
  });

  t.test('createProxyResolvers', (t) => {
    t.plan(2);

    const resolvers = createProxyResolvers(undefined, { Query: { test() {} }, Test: { field() {} } });

    t.ok(resolvers.Query, 'included root resolvers');
    t.ok(!resolvers.Test, 'did not include type resolvers');

  });

});
