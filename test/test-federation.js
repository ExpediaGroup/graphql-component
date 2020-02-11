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
      extend type Extended @key(fields: "id") {
        id: ID! @external
        newProp: String
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

  t.test('extended properties maintained after adding custom directive', (t) => {
    t.plan(2);
    const {schema: {_typeMap: {Extended}}} = component;
    t.equals(Extended.extensionASTNodes.length, 1, 'Extension AST Nodes is defined');
    t.equals(Extended.extensionASTNodes[0].fields.filter((field) => field.name.value === "id" && field.directives[0].name.value === "external").length, 1, `id field marked external`);
  });
});
