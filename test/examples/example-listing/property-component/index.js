'use strict';

const GraphQLComponent = require('../../../../lib/index');
const PropertyProvider = require('./provider');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class PropertyComponent extends GraphQLComponent {
  constructor({ provider = new PropertyProvider(), ...options } = {}) {
    super({ types, resolvers, mocks, provider, ...options });
  }
}

module.exports = PropertyComponent;
