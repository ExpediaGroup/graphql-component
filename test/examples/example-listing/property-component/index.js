'use strict';

const GraphQLComponent = require('../../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');
const { SchemaDirectiveVisitor } = require('graphql-tools');

class PropertyComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers } = {}) {
    const directives = {
      legacy: class extends SchemaDirectiveVisitor {
        visitFieldDefinition(field, details) {
        }
      }
    }
    super({ types: Types, resolvers: Resolvers, mocks: Mocks, useMocks, preserveTypeResolvers, directives });
  }
}

module.exports = PropertyComponent;
