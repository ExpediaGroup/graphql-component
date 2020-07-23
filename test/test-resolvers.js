'use strict';

const Test = require('tape');
const { GraphQLScalarType } = require('graphql');
const {
  memoize,
  wrapResolvers,
  getImportedResolvers,
  createProxyResolver,
} = require('../lib/resolvers');
const GraphQLComponent = require('../lib');

Test('memoize()', (t) => {
  t.test('memoize() a resolver function', (st) => {
    let resolverRunCount = 0;

    const resolverToMemoize = function () {
      resolverRunCount += 1;
      return resolverRunCount;
    };

    const memoizedResolver = memoize('Query', 'test', resolverToMemoize);

    const parent = {};
    const args = {};
    const context = {};

    let callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 1, 'first call of memoized resolver returns expected value');

    callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 1, 'second call of memoizedResolver function doesnt call underlying resolver');
    st.end();
  });

  t.test('memoize() with different operation aliases', (st) => {
    let resolverRunCount = 0;

    const resolverToMemoize = function () {
      resolverRunCount += 1;
      return resolverRunCount;
    };

    const memoizedResolver = memoize('Query', 'test', resolverToMemoize);

    const parent = {};
    const args = {};
    const context = {};
    const infoWithAlias1 = { path: { key: 'alias1' } };
    const infoWithAlias2 = { path: { key: 'alias2' } };

    let callCount = memoizedResolver(parent, args, context, infoWithAlias1);

    st.equal(callCount, 1, 'first call returns expected call count of 1');

    callCount = memoizedResolver(parent, args, context, infoWithAlias2);

    st.equal(callCount, 2, 'second call of same resolver with different alias results in cache miss and call count 2');
    st.end();
  });

  t.test('memoize() with different context', (st) => {
    let resolverRunCount = 0;

    const resolverToMemoize = function () {
      resolverRunCount += 1;
      return resolverRunCount;
    };

    const memoizedResolver = memoize('Query', 'test', resolverToMemoize);

    const parent = {};
    const args = {};
    let context = {};

    let callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 1, 'first call returns expected call count of 1');

    callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 1, 'second call with same context returns expected call count of 1');

    // set context to a new reference
    context = {};
    callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 2, 'third call with different context results in cache miss and expected call count 2');
    st.end();
  });

  t.test('memoize() with different args', (st) => {
    let resolverRunCount = 0;

    const resolverToMemoize = function () {
      resolverRunCount += 1;
      return resolverRunCount;
    };

    const memoizedResolver = memoize('Query', 'test', resolverToMemoize);

    const parent = {};
    const args = {};
    const context = {};

    let callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 1, 'first call returns expected call count of 1');

    args.foo = 'bar';
    callCount = memoizedResolver(parent, args, context);

    st.equal(callCount, 2, 'second call with different args results in cache miss and expected call count 2');
    st.end();
  });
});

Test('wrapResolvers()', (t) => {
  t.test('wrap Query field resolver function', (st) => {
    const resolvers = {
      Query: {
        test() {
          return this.id;
        }
      }
    };

    const wrapped = wrapResolvers({ id: 1 }, resolvers);

    const value = wrapped.Query.test({}, {}, {}, { parentType: 'Query', path: { key: 'test' } });

    st.equal(value, 1, 'Query field resolver is bound');
    st.end();
  });

  t.test('wrap Mutation field resolver function', (st) => {
    const resolvers = {
      Mutation: {
        test() {
          return this.id;
        }
      }
    };

    const wrapped = wrapResolvers({ id: 1 }, resolvers);

    const value = wrapped.Mutation.test({}, {}, {}, { parentType: 'Mutation', path: { key: 'test' } });

    st.equal(value, 1, 'Mutation field resolver is bound');
    st.end();
  });

  t.test('wrap Subscription field resolver object', (st) => {

    const resolvers = {
      Subscription: {
        someSub: {
          subscribe: () => { st.notOk(this.id, 'subscription subscribe() resolver was not bound')}
        }
      }
    };

    const wrapped = wrapResolvers({ id: 1 }, resolvers);
    // call the wrapped resolver result to assert this test case
    wrapped.Subscription.someSub.subscribe();
    st.end();
  });

  t.test('wrap an enum remap', (st) => {
    const resolvers = {
      FooBarEnumType: {
        FOO: 1,
        BAR: 2
      }
    }

    const wrapped = wrapResolvers({id: 1}, resolvers);
    st.equal(wrapped.FooBarEnumType.FOO, 1, 'enum remap runs through wrapResolvers() without error, left as is');
    st.end();
  });

  t.test('wrap non root type field resolver', (st) => {
    const resolvers = {
      SomeType: {
        test() {
          return this.id;
        }
      }
    };

    const wrapped = wrapResolvers({ id: 1 }, resolvers);

    const value = wrapped.SomeType.test({}, {}, {}, { parentType: 'SomeType', path: { key: 'test' } });

    st.equal(value, 1, 'SomeType field resolver is bound');
    st.end();
  });

  t.test('wrap a custom GraphQLScalarType resolver', (st) => {
    const CustomScalarType = new GraphQLScalarType({
      name: 'CustomScalarType',
      description: 'foo bar custom scalar type',
      serialize() {},
      parseValue() {},
      parseLiteral() {}
    })
    const resolvers = {
      Query: {
        foo() {}
      },
      CustomScalarType
    };
    const wrapped = wrapResolvers({ id: 1}, resolvers);
    st.equal(wrapped.CustomScalarType, CustomScalarType, 'wrapped reference is equal to original reference (returned as is)');
    st.end();
  });
});

Test('getImportedResolvers()', (t) => {
  t.test(`import component's resolvers`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          someQuery: SomeType
        }

        type SomeType {
          someField: String
        }
      `,
      resolvers: {
        Query: {
          someQuery() {
            return { someField: 'hello' }
          }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component);
    st.ok(importedResolvers.Query.someQuery.__isProxy, 'Query.someQuery is a proxy');
    st.notOk(importedResolvers.SomeType, 'non-root type (SomeType) is not imported')
    st.end();
  });

  t.test(`import component's resolvers with exclusion`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          someQuery: SomeType
          someOtherQuery: String
        }

        type SomeType {
          someField: String
        }
      `,
      resolvers: {
        Query: {
          someQuery() {
            return { someField: 'hello' }
          },
          someOtherQuery() {
            return 'hello';
          }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component, ['Query.someOtherQuery']);
    st.ok(importedResolvers.Query.someQuery.__isProxy, 'Query.someQuery is a proxy');
    st.notOk(importedResolvers.Query.someOtherQuery, 'Query.someOtherQuery was excluded');
    st.notOk(importedResolvers.SomeType, 'non-root type (SomeType) is not imported')
    st.end();
  });

  t.test(`import component's resolvers that contain an abstract type`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          thing: Thing
        }

        interface Thing {
          id: ID
        }

        type A implements Thing {
          id: ID
          fieldForA: String
        }

        type B implements Thing {
          id: ID
          fieldForB: String
        }
      `,
      resolvers: {
        Query: {
          thing() {
            return { id: '1', fieldForA: 'a', fieldForB: 'b'};
          }
        },
        Thing: {
          __resolveType(thing) {
            if (thing.fieldForA) {
              return 'A';
            } else if (thing.fieldForB) {
              return 'B';
            }
          }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component);
    st.ok(importedResolvers.Query.thing.__isProxy, 'Query.thing is a proxy');
    st.ok(importedResolvers.Thing.__resolveType, '__resolveType was pulled up');
    st.end();
  });
})

Test('createProxyResolver()', (t) => {
  const resolver = createProxyResolver(undefined, 'Query', 'test');
  t.strictEqual(resolver.__isProxy, true, 'function returned is a proxy');
  t.end();
});
