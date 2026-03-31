import { readFileSync } from 'fs';
import { join } from 'path';
import GraphQLComponent from '../../../src';
import LoggingDataSource from './datasource';
import { resolvers } from './resolvers';

const types = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

export default class LoggingComponent extends GraphQLComponent {
  constructor(options = {}) {
    super({
      types,
      resolvers,
      dataSources: [new LoggingDataSource()],
      ...options
    });
  }
}

export { LoggingDataSource };
export * from './types'; 