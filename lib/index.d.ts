import { GraphQLSchema } from 'graphql';
import { IDelegateToSchemaOptions, IExecutableSchemaDefinition } from 'graphql-tools'

interface GraphQLComponentConfigObject {
  component: GraphQLComponent;
  excludes?: string[];
}

interface GraphQLComponentOptions {
  types?: string | string[];
  resolvers?: object;
  mocks?: boolean | object;
  directives?: any;
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
  imports?: GraphQLComponent[] | GraphQLComponentConfigObject[];
  context?: any;
  dataSources?: any[];
  dataSourceOverrides?: any;
}

export default class GraphQLComponent {
  constructor(options?: GraphQLComponentOptions);
  static delegateToComponent(component: GraphQLComponent, options: IDelegateToSchemaOptions): Promise<any>
  readonly name: string;
  readonly schema: GraphQLSchema;
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
