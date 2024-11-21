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
        fieldName: 'propertyById',
        args: {
          id: root.id
        },
        context,
        info
      });
    },
    reviews(root, args, context, info) {;
      return delegateToSchema({
        schema: this.reviewsComponent.schema,
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
