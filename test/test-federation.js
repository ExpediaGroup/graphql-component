'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');
const {SchemaDirectiveVisitor} = require('apollo-server');

Test('federated schema', (t) => {

  class CustomDirective extends SchemaDirectiveVisitor {
    // required for our dummy "custom" directive (ie. implement the SchemaDirectiveVisitor interface)
    visitFieldDefinition() {
      return;
    }
  }

  const component = new GraphQLComponent({
    types: [
      `
      directive @custom on FIELD_DEFINITION

      type Query {
        property(id: ID!): Property @custom
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
    directives: { custom: CustomDirective },
    federation: true
  });

  t.test('create federated schema', (t) => {
    t.plan(1);
    t.doesNotThrow(() => {
      component.schema;
    }, 'can return a buildFederatedSchema schema');
  });

  t.test('custom directive added to federated schema', (t) => {
    t.plan(1);
    const {schema: {_directives: schemaDirectives}} = component;
    t.equals(schemaDirectives.filter((directive) => directive.name === 'custom').length, 1, `federated schema has '@custom' directive`);
  });
});
