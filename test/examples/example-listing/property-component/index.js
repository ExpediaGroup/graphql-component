'use strict';

const GraphQLComponent = require('../../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');
const PropertyProvider = require('./provider');

class PropertyComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers, provider = new PropertyProvider() } = {}) {
    super({ types: Types, resolvers: Resolvers, mocks: Mocks, useMocks, preserveTypeResolvers, provider });
  }
}

module.exports = PropertyComponent;
