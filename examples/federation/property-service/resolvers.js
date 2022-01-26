'use strict';

const resolvers = {
  Query: {
    property(_, { id }, { dataSources }) {
      return dataSources.PropertyDataSource.getPropertyById(id);
    }
  },
  Property: {
    __resolveReference(ref, context) {
      return context.dataSources.PropertyDataSource.getPropertyById(ref.id);
    }
  }
};

module.exports = resolvers;