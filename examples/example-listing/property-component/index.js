
const GraphQLComponent = require('../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Fixtures = require('./fixtures');

class PropertyComponent extends GraphQLComponent {
  constructor({ useFixtures }) {
    super({ types: Types, resolvers: Resolvers, fixtures: Fixtures, useFixtures });
  }
}

module.exports = PropertyComponent;