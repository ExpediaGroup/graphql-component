'use strict';

const GraphQLComponent = require('../../../../lib/index');
const Property = require('../property-component');
const Reviews = require('../reviews-component');
const resolvers = require('./resolvers');
const types = require('./types');
const mocks = require('./mocks');

class ListingComponent extends GraphQLComponent {
  constructor(options) {
    const propertyComponent = new Property();
    const reviewsComponent = new Reviews();

    super ({
      types,
      resolvers,
      mocks,
      imports: [
        {
          component: propertyComponent,
          exclude: ['Query.*']
        },
        {
          component: reviewsComponent,
          exclude: ['Query.*']
        }
      ] ,
      ...options
    });

    this.propertyComponent = propertyComponent;
    this.reviewsComponent = reviewsComponent;
  }
}

module.exports = ListingComponent;
