import debugConfig from 'debug';
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

const debug = debugConfig('graphql-component');

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
}

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
}

export type DataSourceMap = { [key: string]: IDataSource };

export type DataSourceInjectionFunction = ((context: Record<string, unknown>) => DataSourceMap);

export interface IContextConfig {
  namespace: string;
  factory: ContextFunction;
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string | ContextFunction | null, fn?: ContextFunction | string) => void;
}

export interface IGraphQLComponentOptions<TContextType extends ComponentContext = ComponentContext> {
  types?: TypeSource
  resolvers?: IResolvers<any, TContextType>;
  mocks?: boolean | IMocks;
  imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  context?: IContextConfig;
  dataSources?: IDataSource[];
  dataSourceOverrides?: IDataSource[];
  pruneSchema?: boolean;
  pruneSchemaOptions?: PruneSchemaOptions
  federation?: boolean;
  transforms?: SchemaMapper[]
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
export default class GraphQLComponent<TContextType extends ComponentContext = ComponentContext> implements IGraphQLComponent<TContextType>  {
  _schema: GraphQLSchema;
  _types: TypeSource;
  _resolvers: IResolvers<any, TContextType>;
  _mocks: boolean | IMocks;
  _imports: IGraphQLComponentConfigObject[];
  _context: ContextFunction;
  _dataSources: IDataSource[];
  _dataSourceOverrides: IDataSource[];
  _pruneSchema: boolean;
  _pruneSchemaOptions: PruneSchemaOptions
  _federation: boolean;
  _dataSourceContextInject: DataSourceInjectionFunction;
  _transforms: SchemaMapper[]
  private _transformedSchema: GraphQLSchema;

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

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = bindResolvers(this, resolvers);

    this._mocks = mocks;

    this._federation = federation;

    this._transforms = transforms;

    this._dataSources = dataSources || [];

    this._dataSourceOverrides = dataSourceOverrides || [];

    this._dataSourceContextInject = createDataSourceContextInjector(this._dataSources, this._dataSourceOverrides);

    this._pruneSchema = pruneSchema;

    this._pruneSchemaOptions = pruneSchemaOptions;

    this._imports = imports && imports.length > 0 ? imports.map((i: GraphQLComponent | IGraphQLComponentConfigObject) => {
      if (i instanceof GraphQLComponent) {
        if (this._federation === true) {
          i.federation = true;
        }
        return { component: i };
      }
      else {
        const importConfiguration = i as IGraphQLComponentConfigObject;
        if (this._federation === true) {
          importConfiguration.component.federation = true;
        }
        return importConfiguration;
      }
    }) : [];


    this._context = async (globalContext: Record<string, unknown>): Promise<TContextType> => {
      //TODO: currently the context injected into data sources won't have data sources on it
      const ctx = {
        dataSources: this._dataSourceContextInject(globalContext)
      };

      for (const { component } of this.imports) {
        const { dataSources, ...importedContext } = await component.context(globalContext);
        Object.assign(ctx.dataSources, dataSources);
        Object.assign(ctx, importedContext);
      }

      if (context) {
        debug(`building ${context.namespace} context`);

        if (!ctx[context.namespace]) {
          ctx[context.namespace] = {};
        }

        Object.assign(ctx[context.namespace], await context.factory.call(this, globalContext));
      }

      return ctx as TContextType;
    };

    this.validateConfig({ types, imports, mocks, federation });

  }

  get context(): IContextWrapper {

    const contextFn = async (context: Record<string, unknown>): Promise<ComponentContext> => {
      debug(`building root context`);
      
      const middleware: MiddlewareEntry[] = (contextFn as any)._middleware || [];
      
      for (const { name, fn } of middleware) {
        debug(`applying ${name} middleware`);
        context = await fn(context);
      }

      const componentContext = await this._context(context);

      const globalContext = {
        ...context,
        ...componentContext
      };

      return globalContext;
    };

    contextFn._middleware = [];

    contextFn.use = function (name: string, fn: ContextFunction): IContextWrapper {
      if (typeof name === 'function') {
        fn = name;
        name = 'unknown';
      }
      debug(`adding ${name} middleware`);
      contextFn._middleware.push({ name, fn });

      return contextFn;
    };

    return contextFn;
  }

  get name(): string {
    return this.constructor.name;
  }

  get schema(): GraphQLSchema {
    try {
      if (this._schema) {
        return this._schema;
      }

      let makeSchema: (schemaConfig: any) => GraphQLSchema;

      if (this._federation) {
        makeSchema = buildFederatedSchema;
      } else {
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
          resolvers: this._resolvers,
          mergeDirectives: true
        });
      }
      else {
        const schemaConfig = {
          typeDefs: mergeTypeDefs(this._types),
          resolvers: this._resolvers
        }

        this._schema = makeSchema(schemaConfig);
      }

      if (this._transforms) {
        this._schema = this.transformSchema(this._schema, this._transforms);
      }

      if (this._mocks !== undefined && typeof this._mocks === 'boolean' && this._mocks === true) {
        debug(`adding default mocks to the schema for ${this.name}`);
        // if mocks are a boolean support simply applying default mocks
        this._schema = addMocksToSchema({ schema: this._schema, preserveResolvers: true });
      }
      else if (this._mocks !== undefined && typeof this._mocks === 'object') {
        debug(`adding custom mocks to the schema for ${this.name}`);
        // else if mocks is an object, that means the user provided
        // custom mocks, with which we pass them to addMocksToSchema so they are applied
        this._schema = addMocksToSchema({ schema: this._schema, mocks: this._mocks, preserveResolvers: true });
      }

      if (this._pruneSchema) {
        debug(`pruning the schema for ${this.name}`);
        this._schema = pruneSchema(this._schema, this._pruneSchemaOptions);
      }

      debug(`created schema for ${this.name}`);

      return this._schema;
    } catch (error) {
      debug(`Error creating schema for ${this.name}: ${error}`);
      throw new Error(`Failed to create schema for component ${this.name}: ${error.message}`);
    }
  }

  get types(): TypeSource {
    return this._types;
  }

  get resolvers(): IResolvers<any, TContextType> {
    return this._resolvers;
  }

  get imports(): IGraphQLComponentConfigObject[] {
    return this._imports;
  }

  get dataSources(): IDataSource[] {
    return this._dataSources;
  }

  get dataSourceOverrides(): IDataSource[] {
    return this._dataSourceOverrides;
  }

  set federation(flag) {
    this._federation = flag;
  }

  get federation(): boolean {
    return this._federation;
  }

  public dispose(): void {
    this._schema = null;
    this._types = null;
    this._resolvers = null;
    this._imports = null;
    this._dataSources = null;
    this._dataSourceOverrides = null;
  }

  private transformSchema(schema: GraphQLSchema, transforms: SchemaMapper[]): GraphQLSchema {
    if (this._transformedSchema) {
      return this._transformedSchema;
    }

    const functions = {};
    const mapping = {};

    for (const transform of transforms) {
      for (const [key, fn] of Object.entries(transform)) {
        if (!mapping[key]) {
          functions[key] = [];
          let result = undefined;
          mapping[key] = function (...args) {
            while (functions[key].length) {
              const mapper = functions[key].shift();
              result = mapper(...args);
              if (!result) {
                break;
              }
            }
            return result;
          }
        }
        functions[key].push(fn);
      }
    }

    this._transformedSchema = mapSchema(schema, mapping);
    return this._transformedSchema;
  }

  private validateConfig(options: IGraphQLComponentOptions): void {
    if (options.federation && !options.types) {
      throw new Error('Federation requires type definitions');
    }

    if (options.mocks && typeof options.mocks !== 'boolean' && typeof options.mocks !== 'object') {
      throw new Error('mocks must be either boolean or object');
    }
  }

}

// For backward compatibility
module.exports = GraphQLComponent;

/**
 * Wraps data sources with a proxy that intercepts calls to data source methods and injects the current context
 * @param {IDataSource[]} dataSources 
 * @param {IDataSource[]} dataSourceOverrides 
 * @returns {DataSourceInjectionFunction} a function that returns a map of data sources with methods that have been intercepted
 */
const createDataSourceContextInjector = (dataSources: IDataSource[], dataSourceOverrides: IDataSource[]): DataSourceInjectionFunction => {
  const intercept = (instance: IDataSource, context: any) => {
    debug(`intercepting ${instance.constructor.name}`);

    return new Proxy(instance, {
      get(target, key) {
        if (typeof target[key] !== 'function' || key === instance.constructor.name) {
          return target[key];
        }
        const original = target[key];

        return function (...args) {
          return original.call(instance, context, ...args);
        };
      }
    }) as any as DataSource<typeof instance>;
  };

  return (context: any = {}): DataSourceMap => {
    const proxiedDataSources = {};

    // Inject data sources
    for (const dataSource of dataSources) {
      proxiedDataSources[dataSource.name || dataSource.constructor.name] = intercept(dataSource, context);
    }

    // Override data sources
    for (const dataSourceOverride of dataSourceOverrides) {
      proxiedDataSources[dataSourceOverride.name || dataSourceOverride.constructor.name] = intercept(dataSourceOverride, context);
    }

    return proxiedDataSources;
  };
};

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
const memoize = function (parentType: string, fieldName: string, resolve: ResolverFunction): ResolverFunction {
  const _cache = new WeakMap();

  return function _memoizedResolver(_, args, context, info) {
    const path = info && info.path && info.path.key;
    const key = `${path}_${JSON.stringify(args)}`;

    debug(`executing ${parentType}.${fieldName}`);

    let cached = _cache.get(context);

    if (cached && cached[key]) {
      debug(`return cached result of memoized ${parentType}.${fieldName}`);
      return cached[key];
    }

    if (!cached) {
      cached = {};
    }

    const result = resolve(_, args, context, info);

    cached[key] = result;

    _cache.set(context, cached);

    debug(`cached ${parentType}.${fieldName}`);

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
  const boundResolvers = {};

  for (const [type, fields] of Object.entries(resolvers)) {
    // dont bind an object that is an instance of a graphql scalar
    if (fields instanceof GraphQLScalarType) {
      debug(`not binding ${type}'s fields since ${type}'s fields are an instance of GraphQLScalarType`)
      boundResolvers[type] = fields;
      continue;
    }

    if (!boundResolvers[type]) {
      boundResolvers[type] = {};
    }

    for (const [field, resolver] of Object.entries(fields)) {
      if (['Query', 'Mutation'].indexOf(type) > -1) {
        debug(`memoized ${type}.${field}`);
        boundResolvers[type][field] = memoize(type, field, resolver.bind(bindContext));
      }
      else {
        // only bind resolvers that are functions
        if (typeof resolver === 'function') {
          debug(`binding ${type}.${field}`);
          boundResolvers[type][field] = resolver.bind(bindContext);
        }
        else {
          debug(`not binding ${type}.${field} since ${field} is not mapped to a function`);
          boundResolvers[type][field] = resolver;
        }
      }
    }
  }

  return boundResolvers;
};

interface MiddlewareEntry {
  name: string;
  fn: ContextFunction;
}