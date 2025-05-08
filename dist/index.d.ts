import { GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { IResolvers, PruneSchemaOptions, TypeSource, SchemaMapper } from '@graphql-tools/utils';
import { IMocks } from '@graphql-tools/mock';
import { SubschemaConfig } from '@graphql-tools/delegate';
export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;
export interface IGraphQLComponentConfigObject {
    component: IGraphQLComponent;
    configuration?: SubschemaConfig;
}
export interface ComponentContext extends Record<string, unknown> {
    dataSources: DataSourceMap;
}
export type ContextFunction = ((context: Record<string, unknown>) => any);
export interface IDataSource {
    name: string;
    [key: string | symbol]: any;
}
/**
 * Type for implementing data sources
 * When defining a data source class, methods should accept context as their first parameter
 * @example
 * class MyDataSource {
 *   name = 'MyDataSource';
 *
 *   // Context is required as first parameter when implementing
 *   getData(context: ComponentContext, id: string) {
 *     return { id };
 *   }
 * }
 */
export type DataSourceDefinition<T> = {
    [P in keyof T]: T[P] extends Function ? (context: ComponentContext, ...args: any[]) => any : T[P];
};
/**
 * Type for consuming data sources in resolvers
 * When using a data source method, the context is automatically injected
 * @example
 * // In a resolver:
 * Query: {
 *   getData(_, { id }, context) {
 *     // Context is automatically injected, so you don't pass it
 *     return context.dataSources.MyDataSource.getData(id);
 *   }
 * }
 */
export type DataSource<T> = {
    [P in keyof T]: T[P] extends (context: ComponentContext, ...p: infer P) => infer R ? (...p: P) => R : T[P];
};
export type DataSourceMap = {
    [key: string]: IDataSource;
};
export type DataSourceInjectionFunction = ((context: Record<string, unknown>) => DataSourceMap);
export interface IContextConfig {
    namespace: string;
    factory: ContextFunction;
}
export interface IContextWrapper extends ContextFunction {
    use: (name: string | ContextFunction | null, fn?: ContextFunction | string) => void;
}
export interface IGraphQLComponentOptions<TContextType extends ComponentContext = ComponentContext> {
    types?: TypeSource;
    resolvers?: IResolvers<any, TContextType>;
    mocks?: boolean | IMocks;
    imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
    context?: IContextConfig;
    dataSources?: IDataSource[];
    dataSourceOverrides?: IDataSource[];
    pruneSchema?: boolean;
    pruneSchemaOptions?: PruneSchemaOptions;
    federation?: boolean;
    transforms?: SchemaMapper[];
}
export interface IGraphQLComponent<TContextType extends ComponentContext = ComponentContext> {
    readonly name: string;
    readonly schema: GraphQLSchema;
    readonly context: IContextWrapper;
    readonly types: TypeSource;
    readonly resolvers: IResolvers<any, TContextType>;
    readonly imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
    readonly dataSources?: IDataSource[];
    readonly dataSourceOverrides?: IDataSource[];
    federation?: boolean;
}
/**
 * GraphQLComponent class for building modular GraphQL schemas
 * @template TContextType - The type of the context object
 * @implements {IGraphQLComponent}
 */
export default class GraphQLComponent<TContextType extends ComponentContext = ComponentContext> implements IGraphQLComponent {
    _schema: GraphQLSchema;
    _types: TypeSource;
    _resolvers: IResolvers<any, TContextType>;
    _mocks: boolean | IMocks;
    _imports: IGraphQLComponentConfigObject[];
    _context: ContextFunction;
    _dataSources: IDataSource[];
    _dataSourceOverrides: IDataSource[];
    _pruneSchema: boolean;
    _pruneSchemaOptions: PruneSchemaOptions;
    _federation: boolean;
    _dataSourceContextInject: DataSourceInjectionFunction;
    _transforms: SchemaMapper[];
    private _transformedSchema;
    constructor({ types, resolvers, mocks, imports, context, dataSources, dataSourceOverrides, pruneSchema, pruneSchemaOptions, federation, transforms }: IGraphQLComponentOptions);
    get context(): IContextWrapper;
    get name(): string;
    get schema(): GraphQLSchema;
    get types(): TypeSource;
    get resolvers(): IResolvers<any, TContextType>;
    get imports(): IGraphQLComponentConfigObject[];
    get dataSources(): IDataSource[];
    get dataSourceOverrides(): IDataSource[];
    set federation(flag: boolean);
    get federation(): boolean;
    dispose(): void;
    private transformSchema;
    private validateConfig;
}
