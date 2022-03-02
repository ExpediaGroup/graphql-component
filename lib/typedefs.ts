import { GraphQLSchema, Source, DocumentNode, GraphQLResolveInfo } from 'graphql';
import { IMocks, IResolvers } from 'graphql-tools';
import { DirectiveUseMap } from 'graphql-tools';

export type ContextFunction = ((ctx: any) => any);

export interface IContextMiddleware {
  name: string
  fn: ContextFunction
}

export interface IContextConfig {
  namespace: string
  factory: ContextFunction
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string|ContextFunction|null, fn?: ContextFunction|string) => void
}

export interface IGraphQLComponentConfig {
  component: IGraphQLComponent
  exclude: string[]
}

export interface IGraphQLComponent {
  execute: (input: string, options: { root: any, context: {}, variables: {} }) => Promise<any>
  schema: GraphQLSchema
  types: (string | Source | DocumentNode)[]
  resolvers: IResolvers<any, any>
  imports?: IGraphQLComponent[] | IGraphQLComponentConfig[]
  context: ContextFunction
  mocks: IMocks
}

export interface IGraphQLComponentOptions {
  types?: (string | Source | DocumentNode)[]
  resolvers?: IResolvers<any, any>
  imports?: (IGraphQLComponent|IGraphQLComponentConfig)[]
  mocks?: MocksConfigFunction
  directives?: DirectiveUseMap
  context?: IContextConfig
  useMocks?: boolean
  federation?: boolean
  preserveTypeResolvers?: boolean
  dataSources?: any[] //fix this
  dataSourceOverrides?: any[] //fix this
  makeExecutableSchema?: any //fix this
};

export type MocksConfigFunction = (IMocks) => IMocks;

export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;