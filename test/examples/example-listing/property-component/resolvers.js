'use strict';

const resolvers = {
  Query: {
    property(_, { id }, { providers }) {
      return providers.PropertyProvider.getPropertyById(id);
    }
  }
};

module.exports = resolvers;
