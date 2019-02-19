
const GraphQLComponent = require('../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useFixtures }) {
    super ({ 
      types: Types, 
      resolvers: Resolvers, 
      imports: [
        { 
          component: new Property({ useFixtures }), 
          exclude: ['Query.*'] 
        }, 
        { 
          component: new Reviews({ useFixtures }), 
          exclude: ['Query.*']
        } 
      ] 
    });
  }
}

module.exports = ListingComponent;