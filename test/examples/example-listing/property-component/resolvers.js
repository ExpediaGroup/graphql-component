'use strict';

const resolvers = {
  Query: {
    property(_, { id }) {
      return {
        id,
        geo: ['41.40338', '2.17403']
      };
    }
  }
};

module.exports = resolvers;
