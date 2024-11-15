'use strict';

import { delegateToSchema } from '@graphql-tools/delegate';

export const resolvers = {
  Query: {
    async listing(_, { id }) {
      return { id };
    }
  },
  Listing: {
    property(root, args, context, info) {
      return delegateToSchema({
        schema: this.propertyComponent.schema,
        args: {
          id: root.id
        },
        context,
        info
      });
    },
    reviews(root, args, context, info) {
      return delegateToSchema({
        schema: this.reviewsComponent.schema,
        operation: 'query',
        fieldName: 'reviewsByPropertyId',
        args: {
          propertyId: root.id
        },
        context,
        info
      });
    }
  }
};
