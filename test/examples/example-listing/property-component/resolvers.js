'use strict';

const PropertyProvider = require('./provider');

const resolvers = {
  Query: {
    property(_, { id }, { providers }) {
      return providers.get(PropertyProvider).getPropertyById(id);
    }
  }
};

module.exports = resolvers;
