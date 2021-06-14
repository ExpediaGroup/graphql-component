'use strict';

const Test = require('tape');
const { GraphQLScalarType } = require('graphql');
const {
  bindResolvers,
} = require('./index');

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


