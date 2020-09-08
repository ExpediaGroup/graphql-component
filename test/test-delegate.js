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

Test('subscription delegation', async (t) => {
  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: [
          `
            type Post {
              id: ID
              content: String
            }

            type Query {
              postById(id: ID): Post
            }

            type Subscription {
              postAdded: Post
            }
          `
        ],
        resolvers: {
          Query: {
            postById() {
              return { id: 1, content: 'hello' };
            }
          },
          Subscription: {
            postAdded: {
              subscribe() {
                return {
                  [Symbol.asyncIterator]() {
                    return {
                      async next() {
                        return { done: false, value: { postAdded: { id: 2, content: 'foobar'}}};
                      }
                    };
                  }
                }
              }
            }
          }
        }
      })
    ]
  });

  const document = gql`
    subscription {
      postAdded {
        id
        content
      }
    }
  `
  // graphql.subscribe would ultimately be called by servers such as Apollo Server instead of graphql.execute
  const result = await graphql.subscribe({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  // simulate pulling from the async iterator (normally this would be triggered by pubsub)
  for await (const res of result) {
    t.deepEquals(res.data, { postAdded: { id: '2', content: 'foobar' }}, 'subscription result resolved');
    // prevent infinite loop since the source of async iterator never returns a { done: true, value: undefined }
    break;
  }
  t.end();
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

Test('merging errors: correct error message is surfaced in non-nullable situations regardless of order of fields requested', async (t) => {
  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Query {
            foo: Foo
          }

          type Foo {
            a: String!
            b: String!
            c: String
          }
        `,
        resolvers: {
          Query: {
            foo() {
              return {
                a: 'bar',
                b: null,
                c: 'baz'
              }
            }
          }
        }
      })
    ]
  });

  const documentABC = gql`
    query {
      foo {
        a
        b
        c
      }
    }
  `;

  const result1 = await graphql.execute({
    document: documentABC,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  t.equals(result1.errors.length, 1, '1 error is returned in first request');
  t.equals(result1.errors[0].message, 'Cannot return null for non-nullable field Foo.b.', 'expected error message related to Foo.b being non-nullable is returned in first request with field order a,b,c');

  const documentBCA = gql`
    query {
      foo {
        b
        c
        a
      }
    }
  `
  const result2 = await graphql.execute({
    document: documentBCA,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  t.equals(result2.errors.length, 1, '1 error is returned in second request');
  t.equals(result2.errors[0].message, 'Cannot return null for non-nullable field Foo.b.', 'expected error message related to Foo.b being non-nullable is returned in second request with field order b,c,a');
  t.end();
})

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