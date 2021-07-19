'use strict';

const GraphQLComponent = require('../../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');
const resolvers = require('./resolvers');
const types = require('./types');

class ListingComponent extends GraphQLComponent {
  constructor(options) {
    const propertyComponent = new Property();
    const reviewsComponent = new Reviews();

    super ({
      types,
      resolvers,
      imports: [propertyComponent, reviewsComponent],
      ...options
    });

    this.propertyComponent = propertyComponent;
    this.reviewsComponent = reviewsComponent;
  }
}

module.exports = ListingComponent;
