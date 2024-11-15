'use strict';

export const resolvers = {
  Query: {
    property(_, { id }, { dataSources }) {
      return dataSources.PropertyDataSource.getPropertyById(id);
    }
  }
};
