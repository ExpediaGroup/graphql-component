'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib/index');
const gql = require('graphql-tag');
const graphql = require('graphql');

Test('test component execute', (t) => {

  const types = [`
    type Book {
      id: ID!
      title: String
    }
    type Query {
      book(id: ID!) : Book
      bookNonNullable(id: ID!): Book!
    }
  `];

  const resolvers = {
    Query: {
      book(_, { id }) {
        return {
          id,
          title: 'Some Title'
        };
      },
      bookNonNullable() {
        throw new Error('error from resolver with non-nullable return');
      }
    }
  };

  const component = new GraphQLComponent({
    types,
    resolvers
  });

  t.test('execute query', async (t) => {
    t.plan(2);

    const query = `
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.deepEqual(data, { book: { title: 'Some Title' } }, 'has result');
    t.equal(errors.length, 0, 'no errors');
  });

  t.test('execute query with document object', async (t) => {
    t.plan(1);

    const query = gql`
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { book: { title: 'Some Title' } }, 'has result');
  });

  t.test('execute error', async (t) => {
    t.plan(2);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.ok(data);
    t.ok(errors && errors.length === 1, 'error');
  });

  t.test('execute error merged', async (t) => {
    t.plan(1);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.ok(result.book instanceof Error, 'error');
  });

  t.test('execute error merged (non nullable return type)', async (t) => {
    t.plan(1);
    const query = `
      query {
        bookNonNullable(id: "1") {
          title
        }
      }
    `;
    
    const result = await component.execute(query, { mergeErrors: true });
    t.ok(result.bookNonNullable instanceof Error, 'error set at path when graphql.execute returns completely null response');
  });

  t.test('execute error merged regardless of selection set order', async (t) => {
    const composite = new GraphQLComponent({
      types: `
        type Query {
          bar: Foo
        }
  
        type Foo {
          c: String
        }
      `,
      resolvers: {
        Query: {
          async bar() {
            const query = `
              query {
                foo {
                  a
                  b
                }
              }
            `
            const result = await composite.execute(query, { mergeErrors: true });
            return result.foo;
          }
        },
        Foo: {
          c() {
            return 'c';
          }
        }
      },
      imports: [new GraphQLComponent({
        types: `
          type Query {
            foo: Foo
          }
  
          type Foo {
            a: String!
            b: String!
          }
        `,
        resolvers: {
          Query: {
            foo() {
              return { a: 'a', b: null };
            }
          }
        }
      })],
    });
  
    const documentABC = gql`
      query {
        bar {
          a
          b
          c
        }
      }
    `;
  
    const result1 = await graphql.execute({
      document: documentABC,
      schema: composite.schema,
      contextValue: {}
    });
    t.deepEqual(result1.data, { bar: null }, 'data is resolved as expected');
    t.equals(result1.errors.length, 1, '1 error returned');
    t.equals(result1.errors[0].message, 'Cannot return null for non-nullable field Foo.b.', 'error returned related to non-nullable field Foo.b with selection set order a,b,c');
  
    const documentCBA = gql`
      query {
        bar {
          c
          b
          a
        }
      }
    `; 
  
    const result2 = await graphql.execute({
      document: documentCBA,
      schema: composite.schema,
      contextValue: {}
    });
  
    t.deepEqual(result2.data, { bar: null }, 'data is resolved as expected');
    t.equals(result2.errors.length, 1, '1 error returned');
    t.equals(result2.errors[0].message, 'Cannot return null for non-nullable field Foo.b.', 'error returned related to non-nullable field Foo.b with selection set order c, b, a');
    t.end();
  });

  t.test('execute errors merged as expected for non-nullable list that allows nullable items', async (t) => {
    const primitive = new GraphQLComponent({
      types: `
        type Query {
          foos: [Foo]!
        }
        type Foo {
          a: String!
        }
      `,
      resolvers: {
        Query: {
          foos() {
            return [ { a: 'bar'} , {}, { a: 'baz'} ];
          }
        }
      }
    });
  
    const composite = new GraphQLComponent({
      types: `
        type Query {
          bar: Bar
        }
        type Bar {
          foos: [Foo]!
        }
      `,
      resolvers: {
        Query: {
          async bar() {
            const query = `
              query {
                foos { 
                  a
                }
              }
            `
            const result = await composite.execute(query, { mergeErrors: true });
            return { foos: result.foos };
          }
        }
      },
      imports: [primitive]
    });
  
    const document = gql`
      query {
        bar {
          foos {
            a
          }
        }
      }
    `;
  
    const result = await graphql.execute({
      document,
      schema: composite.schema,
      contextValue: {}
    });
  
    t.deepEqual(result.data.bar.foos[0], { a: 'bar' }, 'first item of list resolved as expected');
    t.deepEqual(result.data.bar.foos[2], { a: 'baz' }, 'third item of list resolved as expected');
    t.equal(result.errors.length, 1, 'one error returned');
    t.equal(result.errors[0].message, 'Cannot return null for non-nullable field Foo.a.');
    t.deepEqual(result.errors[0].path, ['foos', 1, 'a']);
    t.end();
  }); 

  t.test('execute multiple query', async (t) => {
    t.plan(1);

    const query = `
      query {
        one: book(id: 1) {
          title
        }
        two: book(id: 2) {
          id,
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { one: { title: 'Some Title' }, two: { id: '2', title: 'Some Title' } }, 'data returned');
  });

  t.test('integration - wrapNonRootTypeResolvers - non root resolver only called 1 time in import', async (t) => {
    let nonRootResolverCount = 0;
    const component = new GraphQLComponent({
      imports: [
        new GraphQLComponent({
          types: `
            type Query {
              foo: Foo
            }
  
            type Foo {
              a: String
              b: Int
            }
          `,
          resolvers: {
            Query: {
              foo() {
                return { a: 'hello' }
              }
            },
            Foo: {
              b() {
                nonRootResolverCount += 1;
                return 10;
              }
            }
          }
        })
      ]
    });
  
    const document = gql`
      query {
        foo {
          a
          b
        }
      }
    `;
  
    const { data, errors } = await graphql.execute({
      document,
      schema: component.schema,
      contextValue: {}
    });
    t.deepEquals(data, { foo: { a: 'hello', b: 10 }}, 'expected response');
    t.notOk(errors, 'no errors');
    t.equals(nonRootResolverCount, 1, 'non root resolver called 1 time');
    t.end();
  });

  t.test('integration - wrapNonRootTypeResolvers - interfaces resolved in import', async (t) => {
    let resolveTypeCount = 0;
    let nonRootResolverCount = 0;
    const component = new GraphQLComponent({
      types: `
        type Query {
          foo: IBar
        }
      `,
      resolvers: {
        Query: {
          async foo() {
            // __typename needs to be in the execute() call selection set
            // this will be documented
            const query = `
              query {
                bar {
                  __typename
                  a
                  ... on Bar {
                    bar
                  }
                }
              }
            `;
            const result = await component.execute(query, { mergeErrors: true });
            return result.bar;
          }
        }
      },
      imports: [
        new GraphQLComponent({
          types: `
            type Query {
              bar: IBar
            }
  
            interface IBar {
              a: String
            }
  
            type Bar implements IBar {
              a: String
              bar: Int
            }
  
            type Baz implements IBar {
              a: String
              baz: Int
            }
          `,
          resolvers: {
            Query: {
              bar() {
                return { a: 'hello', bar: 1 }
              }
            },
            IBar: {
              __resolveType(data) {
                resolveTypeCount += 1;
                if (data.bar) {
                  return 'Bar';
                }
                return 'Baz'
              }
            },
            Bar: {
              bar() {
                nonRootResolverCount += 1;
                return 10;
              }
            }
          }
        })
      ]
    });
  
    const document = gql`
      query {
        foo {
          a
          ... on Bar {
            bar
          }
        }
      }
    `;
  
    const { data, errors } = await graphql.execute({
      document,
      schema: component.schema,
      contextValue: {}
    });
    t.deepEquals(data, { foo: { a: 'hello', bar: 10 }}, 'expected response');
    t.notOk(errors, 'no errors');
    t.equals(resolveTypeCount, 1, '__resolveType called 1 time');
    t.equals(nonRootResolverCount, 1, 'non root resolver called 1 time');
    t.end();
  });
});





