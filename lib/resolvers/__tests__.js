'use strict';

const Test = require('tape');
const { GraphQLScalarType } = require('graphql');
const {
  memoize,
  filterResolvers,
  bindResolvers,
  importResolvers
} = require('./index');
const GraphQLComponent = require('../index');
const graphql = require('graphql');
const gql = require('graphql-tag');

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

Test('filterResolvers()', (t) => {
  t.test('exclusions argument is undefined', (st) => {
    const resolvers = {
      Query: {
        foo() { }
      }
    }
    const transformedResolvers = filterResolvers(resolvers);
    st.equal(transformedResolvers, resolvers, 'object reference returned from filterResolvers is equal to input reference');
    st.deepEqual(transformedResolvers, resolvers, 'object content returned from filterResolvers is equal to input resolver object content');
    st.end();
  });

  t.test('exclusions argument is an empty array', (st) => {
    const resolvers = {
      Query: {
        foo() { }
      }
    }
    const transformedResolvers = filterResolvers(resolvers, []);
    st.equal(transformedResolvers, resolvers, 'object reference returned from filterResolvers is equal to input reference');
    st.deepEqual(transformedResolvers, resolvers, 'object content returned from filterResolvers is equal to input resolver object content');
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

    const transformedResolvers = filterResolvers(resolvers, [['*']]);
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

    const transformedResolvers = filterResolvers(resolvers, [['SomeType']]);
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

    const transformedResolvers = filterResolvers(resolvers, [['SomeType', '']]);
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

    const transformedResolvers = filterResolvers(resolvers, [['SomeType', '*']]);
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

    const transformedResolvers = filterResolvers(resolvers, [['SomeType', 'bar']]);
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

    const transformedResolvers = filterResolvers(resolvers, [['SomeType', 'bar'], ['SomeType', 'a']]);
    st.notOk(transformedResolvers.SomeType, 'specified type is completely removed because all of its fields were removed');
    st.ok(transformedResolvers.Query.foo, 'non-exluded type remains');
    st.end();
  })
});

Test('bindResolvers()', (t) => {
  t.test('bind Query field resolver function', (st) => {
    const resolvers = {
      Query: {
        test() {
          return this.id;
        }
      }
    };

    const bound = bindResolvers({ id: 1 }, resolvers);

    const value = bound.Query.test({}, {}, {}, { parentType: 'Query', path: { key: 'test' } });

    st.equal(value, 1, 'Query field resolver is bound');
    st.end();
  });

  t.test('bind Mutation field resolver function', (st) => {
    const resolvers = {
      Mutation: {
        test() {
          return this.id;
        }
      }
    };

    const bound = bindResolvers({ id: 1 }, resolvers);

    const value = bound.Mutation.test({}, {}, {}, { parentType: 'Mutation', path: { key: 'test' } });

    st.equal(value, 1, 'Mutation field resolver is bound');
    st.end();
  });

  t.test('bind Subscription field resolver object', (st) => {

    const resolvers = {
      Subscription: {
        someSub: {
          subscribe: () => { st.notOk(this.id, 'subscription subscribe() resolver was not bound')}
        }
      }
    };

    const bound = bindResolvers({ id: 1 }, resolvers);
    // call the wrapped resolver result to assert this test case
    bound.Subscription.someSub.subscribe();
    st.end();
  });

  t.test('bind an enum remap', (st) => {
    const resolvers = {
      FooBarEnumType: {
        FOO: 1,
        BAR: 2
      }
    }

    const bound = bindResolvers({id: 1}, resolvers);
    st.equal(bound.FooBarEnumType.FOO, 1, 'enum remap runs through bindResolvers() without error, left as is');
    st.end();
  });

  t.test('bind non root type field resolver', (st) => {
    const resolvers = {
      SomeType: {
        test() {
          return this.id;
        }
      }
    };

    const bound = bindResolvers({ id: 1 }, resolvers);

    const value = bound.SomeType.test({}, {}, {}, { parentType: 'SomeType', path: { key: 'test' } });

    st.equal(value, 1, 'SomeType field resolver is bound');
    st.end();
  });

  t.test('bind a custom GraphQLScalarType resolver', (st) => {
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
    const bound = bindResolvers({ id: 1}, resolvers);
    st.equal(bound.CustomScalarType, CustomScalarType, 'wrapped reference is equal to original reference (returned as is)');
    st.end();
  });
});

Test('importResolvers()', (t) => {
  t.test(`import component's resolvers`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          someQuery: SomeType
        }
        type SomeType {
          someField: String
          anotherField: String
        }
      `,
      resolvers: {
        Query: {
          someQuery() {
            return { someField: 'hello' }
          }
        },
        SomeType: {
          anotherField() {
            return 'foo';
          }
        }
      }
    });

    const importedResolvers = importResolvers(component);
    st.ok(importedResolvers.Query.someQuery, 'Query.someQuery is imported');
    st.ok(importedResolvers.SomeType.anotherField, 'non-root type resolver SomeType.anotherField is imported');
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

    const importedResolvers = importResolvers(component, [['Query', 'someOtherQuery']]);
    st.notOk(importedResolvers.Query.someOtherQuery, 'Query.someOtherQuery was excluded');
    st.end();
  });
})

Test('integration - importing resolvers properly handles enum remaps', async (t) => {
  const component = new GraphQLComponent({
    imports: [new GraphQLComponent({
      types: `
        type Query {
          foo: Foo
        }
        
        type Foo {
          id: ID
          bar: Bar
        }
        enum Bar {
          GOOD
          BAD
        }
      `,
      resolvers: {
        Query: {
          foo() {
            return { id: 1, bar: 'good' }
          }
        },
        Bar: {
          GOOD: 'good',
          BAD: 'bad'
        }
      }
    })]
  });

  const document = gql`
    query {
      foo {
        id
        bar
      }
    }
  `

  const { data, errors } = graphql.execute({
    document,
    schema: component.schema,
    contextValue: {}
  });
  t.deepEqual(data, { foo: { id: '1', bar: 'GOOD'} }, 'schema with enum remap is resolved as expected');
  t.notOk(errors, 'no errors');
  t.end();
}); 


