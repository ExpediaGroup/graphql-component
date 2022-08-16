import { DocumentNode, GraphQLSchema, Source } from 'graphql';
import { IDelegateToSchemaOptions } from '@graphql-tools/delegate';
import { IResolvers, PruneSchemaOptions } from '@graphql-tools/utils';
import { IMocks } from '@graphql-tools/mock';

type DirectiveUseMap = { [key: string]: any };

interface IGraphQLComponentConfigObject {
  component: GraphQLComponent;
  excludes?: string[];
}

type ContextFunction = ((ctx: any) => any);

interface IContextMiddleware {
  name: string
  fn: ContextFunction
}

interface IContextConfig {
  namespace: string
  factory: ContextFunction
}

interface IContextWrapper extends ContextFunction {
  use: (name: string|ContextFunction|null, fn?: ContextFunction|string) => void
}

interface IGraphQLComponentOptions {
  types?: (string | Source | DocumentNode | GraphQLSchema)[] | (string | Source | DocumentNode | GraphQLSchema);
  resolvers?: IResolvers<any, any>;
  mocks?: boolean | MocksConfigFunction;
  directives?: DirectiveUseMap;
  federation?: boolean;
  imports?: GraphQLComponent[] | IGraphQLComponentConfigObject[];
  context?: IContextConfig;
  dataSources?: any[];
  dataSourceOverrides?: any;
  pruneSchema?: boolean;
  pruneSchemaOptions?: PruneSchemaOptions
}

type MocksConfigFunction = (IMocks) => IMocks;

export default class GraphQLComponent {
  constructor(options?: IGraphQLComponentOptions);
  static delegateToComponent(component: GraphQLComponent, options: IDelegateToSchemaOptions): Promise<any>
  readonly name: string;
  readonly schema: GraphQLSchema;
  readonly context: {
    (arg: any): Promise<any>;
    use(name: any, fn: any): void;
  };
  readonly types: string[];
  readonly resolvers: object;
  readonly imports: IGraphQLComponentConfigObject[];
  readonly mocks: any;
  readonly directives: any;
  readonly dataSources: any[];
}
