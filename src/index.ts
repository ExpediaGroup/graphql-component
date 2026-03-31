import { buildFederatedSchema } from '@apollo/federation';
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLSchema } from 'graphql';

import { mergeTypeDefs } from '@graphql-tools/merge';
import {
  pruneSchema,
  IResolvers,
  PruneSchemaOptions,
  TypeSource,
  mapSchema,
  SchemaMapper
} from '@graphql-tools/utils';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { addMocksToSchema, IMocks } from '@graphql-tools/mock';
import { SubschemaConfig } from '@graphql-tools/delegate';

export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;

export interface IGraphQLComponentConfigObject {
  component: IGraphQLComponent;
  configuration?: SubschemaConfig;
}

export interface ComponentContext extends Record<string, unknown> {
  dataSources: DataSourceMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContextFunction = ((context: Record<string, unknown>) => any);

export interface IDataSource {
  name?: string;
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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

export type DataSourceMap = { [key: string]: IDataSource };

export type DataSourceInjectionFunction = ((context: Record<string, unknown>) => DataSourceMap);

export interface IContextConfig {
  namespace: string;
  factory: ContextFunction;
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string | ContextFunction, fn?: ContextFunction) => () => void;
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
export default class GraphQLComponent<TContextType extends ComponentContext = ComponentContext> implements IGraphQLComponent<TContextType> {
  private _schema: GraphQLSchema | null = null;
  private _types: TypeSource;
  private _resolvers: IResolvers<any, TContextType>;
  private _mocks: boolean | IMocks;
  private _imports: IGraphQLComponentConfigObject[];
  private _contextConfig: IContextConfig | undefined;
  private _dataSources: IDataSource[];
  private _dataSourceOverrides: IDataSource[];
  private _pruneSchema: boolean;
  private _pruneSchemaOptions: PruneSchemaOptions;
  private _federation: boolean;
  private _dataSourceContextInject: DataSourceInjectionFunction;
  private _transforms: SchemaMapper[];
  private _transformedSchema: GraphQLSchema | null = null;
  private _middleware: MiddlewareEntry[] = [];
  private _disposed = false;
  private _contextWrapper: IContextWrapper | null = null;
  private _importInjectors: DataSourceInjectionFunction[] | null = null;

  constructor({
    types,
    resolvers,
    mocks,
    imports,
    context,
    dataSources,
    dataSourceOverrides,
    pruneSchema,
    pruneSchemaOptions,
    federation,
    transforms
  }: IGraphQLComponentOptions) {

    this._types = types ? (Array.isArray(types) ? types : [types]) : [];

    this._resolvers = bindResolvers(this, resolvers);

    this._mocks = mocks;

    this._federation = federation;

    this._transforms = transforms;

    this._dataSources = dataSources || [];

    this._dataSourceOverrides = dataSourceOverrides || [];

    this._dataSourceContextInject = createDataSourceContextInjector(this._dataSources, this._dataSourceOverrides);

    this._pruneSchema = pruneSchema;

    this._pruneSchemaOptions = pruneSchemaOptions;

    this._imports = imports && imports.length > 0 ? imports.map((i: IGraphQLComponent | IGraphQLComponentConfigObject) => {
      if (!i) {
        throw new Error('Import cannot be undefined or null');
      }

      // Check if it's already a config object (has 'component' property)
      if ('component' in i && i.component) {
        const comp = (i as IGraphQLComponentConfigObject).component;
        if (comp === (this as unknown as IGraphQLComponent)) {
          throw new Error(`Circular import detected: component "${this.name}" imports itself`);
        }
        return i as IGraphQLComponentConfigObject;
      }

      // Otherwise, treat it as an IGraphQLComponent and wrap it
      if ((i as IGraphQLComponent) === (this as unknown as IGraphQLComponent)) {
        throw new Error(`Circular import detected: component "${this.name}" imports itself`);
      }
      return { component: i as IGraphQLComponent };
    }) : [];

    this._contextConfig = context;

    this.validateConfig({ types, imports, mocks, federation, context, transforms });

  }

  get disposed(): boolean {
    return this._disposed;
  }

  private _assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error(`GraphQLComponent "${this.name}" has been disposed and cannot be used`);
    }
  }

  get context(): IContextWrapper {
    this._assertNotDisposed();

    if (this._contextWrapper) {
      return this._contextWrapper;
    }

    // Cache injectors for imported components so they aren't recreated per request
    if (!this._importInjectors && this._imports.length > 0) {
      this._importInjectors = this._imports.map(({ component }) =>
        createDataSourceContextInjector(component.dataSources || [], component.dataSourceOverrides || [])
      );
    }
    const importInjectors = this._importInjectors;

    const warnedCollisions = new Set<string>();

    const contextFn = async (incomingContext: Record<string, unknown>): Promise<ComponentContext> => {
      this._assertNotDisposed();
      // 1. Inject this component's data sources
      const dataSources = this._dataSourceContextInject(incomingContext);

      // 2. Inject imported components' data sources (available to middleware)
      if (importInjectors) {
        for (const injector of importInjectors) {
          const importedDS = injector(incomingContext);
          for (const dsName of Object.keys(importedDS)) {
            if (dataSources[dsName] && !warnedCollisions.has(dsName)) {
              warnedCollisions.add(dsName);
              console.warn(`GraphQLComponent "${this.name}": data source "${dsName}" is defined by multiple imports and will be overwritten`);
            }
          }
          Object.assign(dataSources, importedDS);
        }
      }

      // 3. Build context with all data sources and run middleware
      let ctx: Record<string, unknown> = Object.assign({}, incomingContext, { dataSources });

      const middleware = [...this._middleware];
      for (const mw of middleware) {
        ctx = await mw.fn(ctx);
      }

      // 4. Process imports in parallel for full context (namespace, non-DS context)
      if (this._imports.length > 0) {
        const importResults = await Promise.all(
          this._imports.map(({ component }) => component.context(ctx))
        );
        for (const { dataSources: importDS, ...importedCtx } of importResults) {
          Object.assign(ctx.dataSources, importDS);
          Object.assign(ctx, importedCtx);
        }
      }

      // 5. Apply this component's namespace context
      if (this._contextConfig) {
        if (!ctx[this._contextConfig.namespace]) {
          ctx[this._contextConfig.namespace] = {};
        }
        const nsCtx = await this._contextConfig.factory.call(this, ctx);
        Object.assign(ctx[this._contextConfig.namespace] as Record<string, unknown>, nsCtx);
      }

      return ctx as ComponentContext;
    };

    contextFn.use = (name: string | ContextFunction, fn?: ContextFunction): (() => void) => {
      if (typeof name === 'function') {
        fn = name;
        name = `middleware_${this._middleware.length}`;
      }
      if (typeof fn !== 'function') {
        throw new Error(`Middleware "${name}" requires a function argument`);
      }
      const entry = { name: name as string, fn };
      this._middleware.push(entry);

      return () => {
        const index = this._middleware.indexOf(entry);
        if (index > -1) this._middleware.splice(index, 1);
      };
    };

    this._contextWrapper = contextFn;
    return contextFn;
  }

  get name(): string {
    return this.constructor.name;
  }

  get schema(): GraphQLSchema {
    this._assertNotDisposed();
    try {
      if (this._schema) {
        return this._schema;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let makeSchema: (schemaConfig: any) => GraphQLSchema;

      if (this._federation) {
        makeSchema = buildFederatedSchema;
      }
      else {
        makeSchema = makeExecutableSchema;
      }

      if (this._imports.length > 0) {
        // iterate through the imports and construct subschema configuration objects
        const subschemas = this._imports.map((imp) => {
          const { component, configuration = {} } = imp;

          return {
            schema: component.schema,
            ...configuration
          };
        });

        // construct an aggregate schema from the schemas of imported
        // components and this component's types/resolvers (if present)
        this._schema = stitchSchemas({
          subschemas,
          typeDefs: this._types,
          resolvers: this._resolvers as IResolvers,
          mergeDirectives: true
        });
      }
      else {
        const schemaConfig = {
          typeDefs: !this._federation && Array.isArray(this._types) && this._types.length === 1 ? this._types[0] : mergeTypeDefs(this._types),
          resolvers: this._resolvers
        };

        this._schema = makeSchema(schemaConfig);
      }

      if (this._transforms) {
        this._schema = this.transformSchema(this._schema, this._transforms);
      }

      if (this._mocks === true) {
        this._schema = addMocksToSchema({ schema: this._schema, preserveResolvers: true });
      }
      else if (this._mocks && typeof this._mocks === 'object') {
        this._schema = addMocksToSchema({ schema: this._schema, mocks: this._mocks, preserveResolvers: true });
      }

      if (this._pruneSchema) {
        this._schema = pruneSchema(this._schema, this._pruneSchemaOptions);
      }

      return this._schema;
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create schema for component ${this.name}: ${message}`, { cause: err });
    }
  }

  get types(): TypeSource {
    this._assertNotDisposed();
    return this._types;
  }

  get resolvers(): IResolvers<any, TContextType> {
    this._assertNotDisposed();
    return this._resolvers;
  }

  get imports(): IGraphQLComponentConfigObject[] {
    this._assertNotDisposed();
    return this._imports;
  }

  get dataSources(): IDataSource[] {
    this._assertNotDisposed();
    return this._dataSources;
  }

  get dataSourceOverrides(): IDataSource[] {
    this._assertNotDisposed();
    return this._dataSourceOverrides;
  }

  set federation(flag) {
    this._federation = flag;
    this.invalidateSchema();
  }

  get federation(): boolean {
    return this._federation;
  }

  public dispose(): void {
    this._disposed = true;
    this._schema = null;
    this._transformedSchema = null;
    this._types = null as unknown as TypeSource;
    this._resolvers = null as unknown as IResolvers;
    this._imports = null as unknown as IGraphQLComponentConfigObject[];
    this._dataSources = null as unknown as IDataSource[];
    this._dataSourceOverrides = null as unknown as IDataSource[];
    this._mocks = null as unknown as boolean | IMocks;
    this._contextConfig = undefined;
    this._dataSourceContextInject = null as unknown as DataSourceInjectionFunction;
    this._transforms = null as unknown as SchemaMapper[];
    this._middleware = [];
    this._contextWrapper = null;
    this._importInjectors = null;
  }

  private transformSchema(schema: GraphQLSchema, transforms: SchemaMapper[]): GraphQLSchema {
    if (this._transformedSchema) {
      return this._transformedSchema;
    }

    const functions: Record<string, ((...args: unknown[]) => unknown)[]> = {};
    const mapping: Record<string, (...args: unknown[]) => unknown> = {};

    for (const transform of transforms) {
      for (const [key, fn] of Object.entries(transform)) {
        if (!mapping[key]) {
          functions[key] = [];
          mapping[key] = function (...args: unknown[]) {
            let result;
            for (const mapper of functions[key]) {
              result = mapper(...args);
              if (result === undefined) {
                break;
              }
            }
            return result;
          };
        }
        functions[key].push(fn);
      }
    }

    this._transformedSchema = mapSchema(schema, mapping);
    return this._transformedSchema;
  }

  public invalidateSchema(): void {
    this._schema = null;
    this._transformedSchema = null;
  }

  private validateConfig(options: IGraphQLComponentOptions): void {
    if (options.federation && !options.types) {
      throw new Error('Federation requires type definitions');
    }

    if (options.mocks !== null && options.mocks !== undefined
        && typeof options.mocks !== 'boolean' && typeof options.mocks !== 'object') {
      throw new Error('mocks must be either boolean or object');
    }

    if (options.context) {
      if (!options.context.namespace || typeof options.context.namespace !== 'string') {
        throw new Error('context.namespace must be a non-empty string');
      }
      if (options.context.namespace === 'dataSources') {
        throw new Error('context.namespace cannot be "dataSources" as it would shadow the data source map');
      }
      if (typeof options.context.factory !== 'function') {
        throw new Error('context.factory must be a function');
      }
    }

    if (options.transforms !== undefined && !Array.isArray(options.transforms)) {
      throw new Error('transforms must be an array');
    }
  }

}

// For backward compatibility with CommonJS require()
module.exports = GraphQLComponent;
module.exports.default = GraphQLComponent;

/**
 * Wraps data sources with a proxy that intercepts calls to data source methods and injects the current context
 * @param {IDataSource[]} dataSources
 * @param {IDataSource[]} dataSourceOverrides
 * @returns {DataSourceInjectionFunction} a function that returns a map of data sources with methods that have been intercepted
 */
function createDataSourceContextInjector(dataSources: IDataSource[], dataSourceOverrides: IDataSource[]): DataSourceInjectionFunction {
  function intercept(instance: IDataSource, context: Record<string, unknown>) {
    // Cache wrapped functions per proxy to avoid creating new wrappers on every property access
    const wrappedMethods = new Map<string | symbol, (...args: unknown[]) => unknown>();

    return new Proxy(instance, {
      get(target, key) {
        if (typeof target[key] !== 'function' || key === instance.constructor.name) {
          return target[key];
        }

        let wrapped = wrappedMethods.get(key);
        if (!wrapped) {
          const original = target[key];
          wrapped = function (...args: unknown[]) {
            return original.call(instance, context, ...args);
          };
          wrappedMethods.set(key, wrapped);
        }

        return wrapped;
      }
    }) as DataSource<typeof instance>;
  }

  return function (context: Record<string, unknown> = {}): DataSourceMap {
    const proxiedDataSources: DataSourceMap = {};

    // Inject data sources
    for (const dataSource of dataSources) {
      proxiedDataSources[dataSource.name != null && dataSource.name !== '' ? dataSource.name : dataSource.constructor.name] = intercept(dataSource, context);
    }

    // Override data sources
    for (const dataSourceOverride of dataSourceOverrides) {
      proxiedDataSources[dataSourceOverride.name != null && dataSourceOverride.name !== '' ? dataSourceOverride.name : dataSourceOverride.constructor.name] = intercept(dataSourceOverride, context);
    }

    return proxiedDataSources;
  };
}

/**
 * memoizes resolver functions such that calls of an identical resolver (args/context/path) within the same request context are avoided
 * @param {string} parentType - the type whose field resolver is being
 * wrapped/memoized
 * @param {string} fieldName -  the field on the parentType whose resolver
 * function is being wrapped/memoized
 * @param {function} resolve - the resolver function that parentType.
 * fieldName is mapped to
 * @returns {function} a function that wraps the input resolver function and
 * whose closure scope contains a WeakMap to achieve memoization of the wrapped
 * input resolver function
 */
const stableStringify = function (args: Record<string, unknown>): string {
  if (!args || typeof args !== 'object') return String(args);
  const keys = Object.keys(args);
  if (keys.length === 0) return '{}';
  keys.sort();
  return keys.map(k => {
    let v: string;
    if (typeof args[k] === 'object') {
      try {
        v = JSON.stringify(args[k]);
      }
      catch {
        v = '[circular]';
      }
    }
    else {
      v = String(args[k]);
    }
    return `${k}:${v}`;
  }).join(',');
};

const memoize = function (parentType: string, fieldName: string, resolve: ResolverFunction): ResolverFunction {
  const _cache = new WeakMap();

  return function _memoizedResolver(_, args, context, info) {
    const path = info && info.path && info.path.key;
    const key = `${path}_${stableStringify(args)}`;

    let cached = _cache.get(context);

    if (cached && cached[key]) {
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    return result;
  };
};

/**
 * make 'this' in resolver functions equal to the input bindContext
 * @param {Object} bind - the object context to bind to resolver functions
 * @param {Object} resolvers - the resolver map containing the resolver
 * functions to bind
 * @returns {Object} - an object identical in structure to the input resolver
 * map, except with resolver function bound to the input argument bind
 */
const bindResolvers = function (bindContext: IGraphQLComponent, resolvers: IResolvers = {}): IResolvers {
  const boundResolvers: Record<string, Record<string, unknown> | GraphQLScalarType> = {};

  for (const [type, fields] of Object.entries(resolvers)) {
    // dont bind an object that is an instance of a graphql scalar
    if (fields instanceof GraphQLScalarType) {
      boundResolvers[type] = fields;
      continue;
    }

    if (!boundResolvers[type]) {
      boundResolvers[type] = {};
    }

    const typeResolvers = boundResolvers[type] as Record<string, unknown>;

    for (const [field, resolver] of Object.entries(fields)) {
      if (typeof resolver === 'function') {
        if (type === 'Query') {
          typeResolvers[field] = memoize(type, field, resolver.bind(bindContext));
        }
        else {
          typeResolvers[field] = resolver.bind(bindContext);
        }
      }
      else {
        typeResolvers[field] = resolver;
      }
    }
  }

  return boundResolvers as IResolvers;
};

interface MiddlewareEntry {
  name: string;
  fn: ContextFunction;
}