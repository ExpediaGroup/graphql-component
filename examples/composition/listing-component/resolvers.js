'use strict';

const GraphQLComponent = require('../../../lib');

const resolvers = {
  Query: {
    async listing(_, { id }) {
      return { id };
    }
  },
  Listing: {
    property(root, args, context, info) {
      return GraphQLComponent.delegateToComponent(this.propertyComponent, {
        args: {
          id: root.id
        },
        context,
        info
      })
    },
    reviews(root, args, context, info) {
      return GraphQLComponent.delegateToComponent(this.reviewsComponent, {
        operation: 'query',
        fieldName: 'reviewsByPropertyId',
        args: {
          propertyId: root.id
        },
        context,
        info
      })
    }
  }
};

module.exports = resolvers;
