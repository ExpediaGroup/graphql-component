'use strict';

import { types } from "./types";
import { resolvers } from "./resolvers";
import GraphQLComponent from "../../../src";
import Property from "../property-component";
import Reviews from "../reviews-component";


export default class ListingComponent extends GraphQLComponent {
  propertyComponent: Property;
  reviewsComponent: Reviews;
  
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
