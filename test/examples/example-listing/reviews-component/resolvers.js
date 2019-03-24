'use strict';

const resolvers = {
  Query: {
    reviewsByPropertyId(_, { propertyId }) {
      return [{
        id: 1,
        propertyId: 1,
        content: 'content for review'
      }];
      //throw new Error('Query.reviewsByPropertyId not implemented');
    }
  }
};

module.exports = resolvers;
