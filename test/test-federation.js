'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');

Test('federated schema', (t) => {

  t.plan(1);

  const component = new GraphQLComponent({
    types: [
      `
      type Query {
        property(id: ID!): Property
      }
      type Property @key(fields: "id") {
        id: ID!
        geo: [String]
      }
      `
    ],
    resolvers: {
      Query: {
        property(_, { id }, context, info) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      },
      Property: {
        __resolveReference(property, context) {
          
        }
      }
    },
    federation: true
  });

  t.doesNotThrow(() => {
    component.schema;
  }, 'can return a buildFederatedSchema schema');
});
