import { GraphQLResolveInfo } from 'graphql';
import { IExecutableSchemaDefinition } from '@graphql-tools/schema';

interface GraphQLComponentConfigObject {
  component: GraphQLComponent;
  excludes?: string[];
}

interface GraphQLComponentOptions {
  types?: string[];
  resolvers?: object;
  imports?: GraphQLComponent[] | GraphQLComponentConfigObject[];
  mocks?: (importedMocks: any) => any;
  directives?: any;
  context?: any;
  useMocks?: boolean;
  preserveResolvers?: boolean;
  dataSources?: any[];
  dataSourceOverrides?: any;
  federation?: boolean;
  makeExecutableSchema?: <TContext = any>({
    typeDefs,
    resolvers,
    resolverValidationOptions,
    parseOptions,
    inheritResolversFromInterfaces,
    pruningOptions,
    updateResolversInPlace,
    schemaExtensions
  }) => IExecutableSchemaDefinition<TContext>;
}

export default class GraphQLComponent {
  constructor(options?: GraphQLComponentOptions);
  static isComponent(check: any): any;
  static delegateToComponent(component: GraphQLComponent, options: {
    info: GraphQLResolveInfo;
    contextValue: any;
    targetRootField?: string;
    subPath?: string;
    args?: object;
  }): Promise<any>
  readonly name: string;
  readonly id: string;
  readonly schema: any;
  readonly context: {
    (arg: any): Promise<any>;
    use(name: any, fn: any): void;
  };
  readonly types: string[];
  readonly resolvers: object;
  readonly imports: GraphQLComponentConfigObject[];
  readonly mocks: any;
  readonly directives: any;
  readonly dataSources: any[];
}
