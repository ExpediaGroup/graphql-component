'use strict';

import { ApolloServer } from 'apollo-server';
import GraphQLComponent from '../../../dist';
import ReviewsDataSource from './datasource';
import resolvers from './resolvers';
import types from './types';
import toUppercaseDirective from './toUppercaseDirective';

interface ReviewsComponentOptions {
  [key: string]: any;
}

class ReviewsComponent extends GraphQLComponent {
  constructor(options: ReviewsComponentOptions) {
    super(options);
  }
}

const run = async function (): Promise<void> {
  const { schema, context } = new ReviewsComponent({
    types,
    resolvers,
    dataSources: [new ReviewsDataSource()],
    directives: {
      toUppercase: toUppercaseDirective
    },
    federation: true
  });

  const server = new ApolloServer({
    schema,
    context
  });

  const { url } = await server.listen({port: 4002})
  console.log(`🚀 Reviews service ready at ${url}`)
}

export { run }; 