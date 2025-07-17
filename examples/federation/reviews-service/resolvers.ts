'use strict';

import { ComponentContext } from "../../../src";

const resolvers = {
  Query: {
    reviewsByPropertyId(_: any, { propertyId }: { propertyId: string }, { dataSources }: ComponentContext) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(propertyId);
    }
  },
  Property: {
    reviews(root: { id: string }, _args: any, { dataSources }: ComponentContext) {
      return dataSources.ReviewsDataSource.getReviewsByPropertyId(root.id);
    }
  }
};

export default resolvers; 