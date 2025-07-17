'use strict';

import { ApolloServer } from 'apollo-server';
import GraphQLComponent from '../../../dist';
import PropertyDataSource from './datasource';
import resolvers from './resolvers';
import types from './types';

interface PropertyComponentOptions {
  [key: string]: any;
}

class PropertyComponent extends GraphQLComponent {
  constructor(options: PropertyComponentOptions) {
    super(options);
  }
}

const run = async function (): Promise<void> {
  const { schema, context } = new PropertyComponent({
    types,
    resolvers,
    dataSources: [new PropertyDataSource()],
    federation: true
  });

  const server = new ApolloServer({
    schema,
    context
  });

  const { url } = await server.listen({port: 4001})
  console.log(`🚀 Property service ready at ${url}`)
}

export { run }; 