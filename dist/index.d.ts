import { GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { IResolvers, DirectiveUseMap, SubschemaConfig, PruneSchemaOptions, ITypedef, IMocks } from 'graphql-tools';
export declare type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;
export interface IGraphQLComponentConfigObject {
    component: IGraphQLComponent;
    configuration?: SubschemaConfig;
}
export declare type ContextFunction = ((ctx: any) => any);
export interface IDataSource {
    name: string;
}
export declare type DataSourceMap = {
    [key: string]: IDataSource;
};
export declare type DataSourceInjectionFunction = ((ctx: any) => DataSourceMap);
export interface IContextConfig {
    namespace: string;
    factory: ContextFunction;
}
export interface IContextWrapper extends ContextFunction {
    use: (name: string | ContextFunction | null, fn?: ContextFunction | string) => void;
}
export interface IGraphQLComponentOptions {
    types?: ITypedef | ITypedef[];
    resolvers?: IResolvers<any, any>;
    mocks?: IMocks;
    directives?: DirectiveUseMap;
    imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
    context?: IContextConfig;
    dataSources?: any[];
    dataSourceOverrides?: any;
    pruneSchema?: boolean;
    pruneSchemaOptions?: PruneSchemaOptions;
    federation?: boolean;
}
export interface IGraphQLComponent {
    readonly name: string;
    readonly schema: GraphQLSchema;
    readonly context: IContextWrapper;
    readonly types: ITypedef[];
    readonly resolvers: IResolvers<any, any>;
    readonly imports?: IGraphQLComponentConfigObject[];
    readonly directives?: DirectiveUseMap;
    readonly dataSources?: IDataSource[];
    federation?: boolean;
    overrideDataSources: (dataSources: DataSourceMap, context: any) => void;
}
export default class GraphQLComponent implements IGraphQLComponent {
    _schema: GraphQLSchema;
    _types: ITypedef[];
    _resolvers: IResolvers<any, any>;
    _mocks: IMocks;
    _directives: DirectiveUseMap;
    _imports: IGraphQLComponentConfigObject[];
    _context: ContextFunction;
    _dataSources: IDataSource[];
    _dataSourceOverrides: IDataSource[];
    _pruneSchema: boolean;
    _pruneSchemaOptions: PruneSchemaOptions;
    _federation: boolean;
    _dataSourceInjection: DataSourceInjectionFunction;
    constructor({ types, resolvers, mocks, directives, imports, context, dataSources, dataSourceOverrides, pruneSchema, pruneSchemaOptions, federation }: IGraphQLComponentOptions);
    overrideDataSources(dataSources: DataSourceMap, context: any): void;
    get name(): string;
    get schema(): GraphQLSchema;
    get context(): IContextWrapper;
    get types(): ITypedef[];
    get resolvers(): IResolvers;
    get imports(): IGraphQLComponentConfigObject[];
    get directives(): DirectiveUseMap;
    get dataSources(): IDataSource[];
    set federation(flag: boolean);
    get federation(): boolean;
    get dataSourceInjection(): DataSourceInjectionFunction;
}
