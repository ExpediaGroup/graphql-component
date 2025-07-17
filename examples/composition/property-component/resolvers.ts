

export const resolvers = {
  Query: {
    propertyById(_, { id }, { dataSources }) {
      return dataSources.PropertyDataSource.getPropertyById(id);
    }
  }
};
