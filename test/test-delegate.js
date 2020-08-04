'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');
const graphql = require('graphql');
const gql = require('graphql-tag');

Test('automatic imported root resolver delegation', async (t) => {

  t.plan(2);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
          }
          type Query {
            test: Test
          }
        `,
        resolvers: {
          Query: {
            test() {
              return {
                value: true
              }
            }
          }
        }
      })
    ]
  });

  const document = gql`
    query {
      test { value }
    }
  `;

  const { data, errors } = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(data.test.value, true, 'resolved');
  t.notOk(errors, 'no errors');
});

Test('automatic imported root resolver delegation with errors', async (t) => {

  t.plan(4);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
            err: Boolean
          }
          type Query {
            test: Test
          }
        `,
        resolvers: {
          Query: {
            test() {
              return {
                value: true,
                err: true
              }
            }
          },
          Test: {
            err(_) {
              if (_.err) {
                throw new Error('error');
              }
            }
          }
        }
      })
    ]
  });

  const successDocument = gql`
    query {
      test { value }
    }
  `;

  const errorDocument = gql`
    query {
      test {
        value
        err
      }
    }
  `;

  const successResult = await graphql.execute({
    document: successDocument,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(successResult.data.test.value, true, 'resolved');
  t.notOk(successResult.errors, 'no errors');

  const errorResult = await graphql.execute({
    document: errorDocument,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(errorResult.data.test.value, true, 'resolved');
  t.equal(errorResult.errors[0].message, 'error', 'error propagated properly');
});

Test('automatic imported root resolver delegation with errors (return type not nullable)', async (t) => {

  t.plan(2);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
          }
          type Query {
            test: Test!
          }
        `,
        resolvers: {
          Query: {
            test() {
              throw new Error('error in proxied root resolver');
            }
          }
        }
      })
    ]
  });

  const document = gql`
    query {
      test {
        value
      }
    }
  `;

  const {data, errors} = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.notOk(data, 'data is null');
  t.equal(errors[0].message, 'error in proxied root resolver', 'error propagated properly');
});

Test('automatic root resolver delegation with abstract return type', async (t) => {
  t.plan(3);

  let resolveTypeCallCount = 0;
  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          interface ITest {
            id: ID
          }
          type Test implements ITest {
            id: ID
            value: Boolean
          }
          type Query {
            test: ITest
          }
        `,
        resolvers: {
          Query: {
            test() {
              return { id: 1, value: true };
            }
          },
          ITest: {
            __resolveType(i) {
              resolveTypeCallCount = resolveTypeCallCount + 1;
              if (i.value) {
                return 'Test'
              }
            }
          }
        }
      })
    ]
  });

  const document = gql`
    query {
      test {
        id
        value
      }
    }
  `;

  const {data, errors} = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.deepEqual(data.test, { id: '1', value: true});
  t.equals(resolveTypeCallCount, 1, '__resolveType in import only called 1 time');
  t.notOk(errors, 'no errors');
});