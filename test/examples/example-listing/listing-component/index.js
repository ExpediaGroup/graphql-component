'use strict';

const GraphQLComponent = require('../../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Mocks = require('./mocks');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    const propertyComponent = new Property();
    const reviewsComponent = new Reviews();

    super ({
      types: Types,
      resolvers: Resolvers,
      mocks: Mocks,
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
      useMocks,
      preserveTypeResolvers
    });

    this.propertyComponent = propertyComponent;
    this.reviewsComponent = reviewsComponent;
  }
}

module.exports = ListingComponent;
