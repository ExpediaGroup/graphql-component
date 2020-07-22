'use strict';

const Test = require('tape');
const { GraphQLScalarType } = require('graphql');
const {
  memoize,
  transformResolvers,
  wrapResolvers,
  createProxyResolver,
  createProxyResolvers,
} = require('./index');

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
    const info = {
      path: {
        key: 'test'
      }
    }

    let callCount = memoizedResolver(parent, args, context, info);

    st.equal(callCount, 1, 'first call of memoized resolver returns expected value');

    callCount = memoizedResolver(parent, args, context, info);

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
    const info = { path: { key: 'test'} };

    let callCount = memoizedResolver(parent, args, context, info);

    st.equal(callCount, 1, 'first call returns expected call count of 1');

    callCount = memoizedResolver(parent, args, context, info);

    st.equal(callCount, 1, 'second call with same context returns expected call count of 1');

    // set context to a new reference
    context = {};
    callCount = memoizedResolver(parent, args, context, info);

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
    const info = { path: { key: 'test'} };

    let callCount = memoizedResolver(parent, args, context, info);

    st.equal(callCount, 1, 'first call returns expected call count of 1');

    args.foo = 'bar';
    callCount = memoizedResolver(parent, args, context, info);

    st.equal(callCount, 2, 'second call with different args results in cache miss and expected call count 2');
    st.end();
  });
});

Test('transformResolvers()', (t) => {
  t.test('exclusions argument is undefined', (st) => {
    const resolvers = {
      Query: {
        foo() { }
      }
    }
    const transformedResolvers = transformResolvers(resolvers);
    st.equal(transformedResolvers, resolvers, 'object reference returned from transformResolvers is equal to input reference');
    st.deepEqual(transformedResolvers, resolvers, 'object content returned from transformResolver is equal to input resolver object content');
    st.end();
  });

  t.test('exclusions argument is an empty array', (st) => {
    const resolvers = {
      Query: {
        foo() { }
      }
    }
    const transformedResolvers = transformResolvers(resolvers, []);
    st.equal(transformedResolvers, resolvers, 'object reference returned from transformResolvers is equal to input reference');
    st.deepEqual(transformedResolvers, resolvers, 'object content returned from transformResolver is equal to input resolver object content');
    st.end();
  });

  t.test(`exclude all types via '*'`, (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      Mutation: {
        baz() {}
      },
      SomeType: {
        bar() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['*']]);
    st.deepEqual(transformedResolvers, {}, 'results in an empty resolver map being returned');
    st.end();
  });

  t.test(`exclude a entire type by specifying 'Type' exclusion)`, (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      SomeType: {
        bar() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['SomeType']]);
    st.notOk(transformedResolvers.SomeType, 'entire specified type is excluded');
    st.ok(transformedResolvers.Query.foo, 'other non-excluded type remains');
    st.end();
  });

  t.test(`exclude an entire type by specifying 'Type.' exclusion`, (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      SomeType: {
        bar() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['SomeType', '']]);
    st.notOk(transformedResolvers.SomeType,'entire specified type is excluded');
    st.ok(transformedResolvers.Query.foo, 'other non-excluded type remains');
    st.end();
  });

  t.test(`exclude an entire type by specifying 'Type.*' exclusion`, (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      SomeType: {
        bar() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['SomeType', '*']]);
    st.notOk(transformedResolvers.SomeType, 'entire specified type is excluded');
    st.ok(transformedResolvers.Query.foo, 'other non-excluded type remains');
    st.end();
  });

  t.test(`exclude an individual field on a type`, (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      SomeType: {
        bar() {},
        a() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['SomeType', 'bar']]);
    st.notOk(transformedResolvers.SomeType.bar, 'specified field on specified type is removed');
    st.ok(transformedResolvers.SomeType.a, 'non-excluded field on specified type remains');
    st.ok(transformedResolvers.Query.foo, 'non-exluded type remains');
    st.end();
  });

  t.test('exclude all fields on a type via 1 by 1 exclusion', (st) => {
    const resolvers = {
      Query: {
        foo() {}
      },
      SomeType: {
        bar() {},
        a() {}
      }
    };

    const transformedResolvers = transformResolvers(resolvers, [['SomeType', 'bar'], ['SomeType', 'a']]);
    st.notOk(transformedResolvers.SomeType, 'specified type is completely removed because all of its fields were removed');
    st.ok(transformedResolvers.Query.foo, 'non-exluded type remains');
    st.end();
  })
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

Test('createProxyResolver()', (t) => {
  const resolver = createProxyResolver(undefined, 'Query', 'test');
  t.strictEqual(resolver.__isProxy, true, 'function returned is a proxy');
  t.end();
});

Test('createProxyResolvers()', (t) => {
  t.test('resolver map passed to createProxyResolvers()', (st) => {
    const resolvers = {
      Query: {
        foo() { }
      },
      Foo: {
        bar() { }
      }
    };
  
    const proxiedResolvers = createProxyResolvers(undefined, resolvers);
    st.ok(proxiedResolvers.Query.foo.__isProxy, 'root type field resolver is a proxy');
    st.notOk(proxiedResolvers.Foo, `non root type isn't returned with proxied resolver map`);
    st.end();
  });
});
