'use strict';

import { ComponentContext } from "../../../src";

const resolvers = {
  Query: {
    property(_: any, { id }: { id: string }, { dataSources }: ComponentContext) {
      return dataSources.PropertyDataSource.getPropertyById(id);
    }
  },
  Property: {
    __resolveReference(ref: { id: string }, { dataSources }: ComponentContext) {
      return dataSources.PropertyDataSource.getPropertyById(ref.id);
    }
  }
};

export default resolvers; 