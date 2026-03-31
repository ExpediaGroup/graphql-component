import { readFileSync } from 'fs';
import { join } from 'path';
import GraphQLComponent from '../../../src';
import AuthDataSource from './datasource';
import { resolvers } from './resolvers';

const types = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

export default class AuthComponent extends GraphQLComponent {
  constructor(options = {}) {
    super({
      types,
      resolvers,
      dataSources: [new AuthDataSource()],
      ...options
    });
  }
}

export { AuthDataSource };
export * from './types'; 