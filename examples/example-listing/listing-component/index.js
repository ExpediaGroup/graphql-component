
const GraphQLComponent = require('../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    super ({ 
      types: Types, 
      resolvers: Resolvers, 
      imports: [
        new Property({ useMocks, preserveTypeResolvers }),
        new Reviews({ useMocks, preserveTypeResolvers })
      ] 
    });
  }
}

module.exports = ListingComponent;