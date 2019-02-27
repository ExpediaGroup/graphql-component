
const GraphQLComponent = require('../../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor() {
    super ({ 
      imports: [
        new Property(),
        new Reviews()
      ]
    });
  }
}

module.exports = ListingComponent;