'use strict';

export const resolvers = {
  Query: {
    property(_, { id }, context) {
      return context.dataSources.PropertyDataSource.getPropertyById(id);
    }
  }
};
