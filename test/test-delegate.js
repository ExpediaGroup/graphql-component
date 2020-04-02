'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');

Test('component resolver delegate', async (t) => {

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

Test('component resolver delegate errors', async (t) => {

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
  
  t.equal(test.value, true, 'resolved');
  t.ok(test.err instanceof Error, 'got error');
});