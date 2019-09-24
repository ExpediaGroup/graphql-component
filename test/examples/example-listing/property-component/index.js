'use strict';

const GraphQLComponent = require('../../../../lib/index');
const PropertyDataSource = require('./datasource');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class PropertyComponent extends GraphQLComponent {
  constructor({ dataSource = new PropertyDataSource(), ...options } = {}) {
    super({ types, resolvers, mocks, dataSource, ...options });
  }
}

module.exports = PropertyComponent;
