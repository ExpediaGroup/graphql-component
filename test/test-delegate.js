'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');

Test(`parent pulls up and delegates to child's query`, async (t) => {

  t.plan(1);

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

  const { test } = await component.execute(`query { test { ...AllTest } }`, { mergeErrors: true });
  
  t.equal(test.value, true, 'resolved');
});

Test('parent pulls up and delegates to child query that throws error', async (t) => {

  t.plan(2);

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

  const { test } = await component.execute(`query { test { ...AllTest } }`, { mergeErrors: true });
  
  t.equal(test.value, true, 'field `value` resolved as expected');
  t.ok(test.err instanceof Error, 'field `error` resolved as error');
});

Test(`parent delegates to child's query that returns an abstract type`, async (t) => {
  let childResolveTypeCallCount = 0;
  const child = new GraphQLComponent({
    types: `
      type Query {
        inventory: [Item]
      }

      interface Item {
        id: ID
      }

      type Book implements Item {
        id: ID
        title: String
      }

      type Laptop implements Item {
        id: ID
        brand: String
      }
    `,
    resolvers: {
      Query: {
        inventory() {
          return [
            {
              id: 1,
              title: 'Some book title'
            },
            {
              id: 2,
              brand: 'Apple'
            }
          ];
        }
      },
      Item: {
        __resolveType(item) {
          childResolveTypeCallCount = childResolveTypeCallCount + 1;
          if (item.title) {
            return 'Book'
          } else if (item.brand) {
            return 'Laptop'
          }
        }
      }
    }
  })
  const parent = new GraphQLComponent({
    imports: [
      child
    ]
  });

  const result = await parent.execute(`query { inventory { id, ... on Book { title }, ... on Laptop { brand } } }`);
  t.ok(parent._importedResolvers.Query.inventory.__isProxy, `parent's query resolver is a proxy`);
  t.equals(childResolveTypeCallCount, 2, `child's resolveType function only called 2 times (1 per result item)`);
  t.deepEquals(result.data.inventory, [
    {
      id: '1',
      title: 'Some book title',
      __typename: 'Book'
    },
    {
      id: '2',
      brand: 'Apple',
      __typename: 'Laptop'
    }
  ], 'query resolved as expected');
  t.equals(result.errors.length, 0, 'no errors');

  t.end();
});

Test('parent delegates to child that results in non-root type resolver execution in child', async (t) => {
  let childNonRootResolverCount = 0;
  const child = new GraphQLComponent({
    types: `
      type Query {
        child: Child
      }

      type Child {
        childField1: String
        childField2: String
      }
    `,
    resolvers: {
      Query: {
        child() {
          return { childField1: 'childField1' };
        }
      },
      Child: {
        childField2: function (parent) {
          childNonRootResolverCount = childNonRootResolverCount + 1;
          if (parent.childField1) {
            return `${parent.childField1}-modified`;
          } else {
            return 'childField2'
          }
        }
      }
    }
  })
  const parent = new GraphQLComponent({
    imports: [
      child
    ]
  });

  const result = await parent.execute(`query { child { childField1 childField2 }}`);
  t.ok(parent._importedResolvers.Query.child.__isProxy, `parent's query resolver is a proxy`);
  t.equals(childNonRootResolverCount, 1, `child's non root type resolver only called 1 time`);
  t.deepEquals(result.data.child, { childField1: 'childField1', childField2: 'childField1-modified', __typename: 'Child'});
  t.equals(result.errors.length, 0, 'no errors');
  t.end();
})