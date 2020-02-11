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