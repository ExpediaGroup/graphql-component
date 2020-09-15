'use strict';

const Test = require('tape');
const { GraphQLScalarType } = require('graphql');
const GraphQLComponent = require('../lib/index');
const {
  memoize,
  bindResolvers,
  getImportedResolvers,
} = require('../lib/resolvers');
const gql = require('graphql-tag');
const graphql = require('graphql');

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
    // call the bound resolver result to assert this test case
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
    st.equal(bound.CustomScalarType, CustomScalarType, 'bound reference is equal to original reference (returned as is)');
    st.end();
  });
});

Test('getImportedResolvers()', (t) => {
  t.test(`import component's resolvers, no exclusion`, (st) => {
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
          anotherField() { return 'another field' }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component, []);
    st.notOk(importedResolvers.Query.someQuery.__isProxy, 'Query.someQuery is imported and not a proxy');
    st.ok(importedResolvers.SomeType.anotherField, 'non-root type resolver is imported');
    st.end();
  });

  t.test(`import component's resolvers with explicit exclusion`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          someQuery: SomeType
          someOtherQuery: String
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
          },
          someOtherQuery() {
            return 'hello';
          }
        },
        SomeType: {
          anotherField() { return 'anotherField' }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component, ['Query.someOtherQuery']);
    st.notOk(importedResolvers.Query.someOtherQuery, 'Query.someOtherQuery was excluded');
    st.ok(importedResolvers.SomeType.anotherField, 'non-root type resolver is imported');
    st.end();
  });

  t.test(`import component's resolvers with wild card exclusion`, (st) => {
    const component = new GraphQLComponent({
      types: `
        type Query {
          someQuery: SomeType
          someOtherQuery: String
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
          },
          someOtherQuery() {
            return 'hello';
          }
        },
        SomeType: {
          anotherField() { return 'anotherField' }
        }
      }
    });

    const importedResolvers = getImportedResolvers(component, ['Query.*']);
    st.notOk(importedResolvers.Query, 'no Query type resolvers were imported');
    st.ok(importedResolvers.SomeType.anotherField, 'non-root type resolver is imported');
    st.end();
  });
});

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