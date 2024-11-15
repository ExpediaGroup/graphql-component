const debug = require('debug')('graphql-component');

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

export type ContextFunction = ((ctx: any) => any);

export interface IDataSource {
  name: string
}

export type DataSource<T> = {
  [P in keyof T]: T[P] extends (ctx: any, ...p: infer P) => infer R ? (...p: P) => R : never
}

export type DataSourceMap = {[key: string]: IDataSource};

export type DataSourceInjectionFunction = ((ctx: any) => DataSourceMap);

export interface IContextConfig {
  namespace: string;
  factory: ContextFunction;
}

export interface IContextWrapper extends ContextFunction {
  use: (name: string|ContextFunction|null, fn?: ContextFunction|string) => void;
}

export interface IGraphQLComponentOptions {
  types?: TypeSource
  resolvers?: IResolvers<any, any>;
  mocks?: IMocks;
  imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  context?: IContextConfig;
  dataSources?: IDataSource[];
  dataSourceOverrides?: IDataSource[];
  pruneSchema?: boolean;
  pruneSchemaOptions?: PruneSchemaOptions
  federation?: boolean;
  transforms?: SchemaMapper[]
}

export interface IGraphQLComponent {
  readonly name: string;
  readonly schema: GraphQLSchema;
  readonly context: IContextWrapper;
  readonly types: TypeSource;
  readonly resolvers: IResolvers<any, any>;
  readonly imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  readonly dataSources?: IDataSource[];
  overrideDataSources: (dataSources: DataSourceMap, context: any) => void
  federation?: boolean;
}

export default class GraphQLComponent implements IGraphQLComponent {
  _schema: GraphQLSchema;
  _types: TypeSource;
  _resolvers: IResolvers<any, any>;
  _mocks: IMocks;
  _imports: IGraphQLComponentConfigObject[];
  _context: ContextFunction;
  _dataSources: IDataSource[];
  _dataSourceOverrides: IDataSource[];
  _pruneSchema: boolean;
  _pruneSchemaOptions: PruneSchemaOptions
  _federation: boolean;
  _dataSourceInjection: DataSourceInjectionFunction;
  _transforms: SchemaMapper[]

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


    this._context = async (globalContext: any): Promise<any> => {
      const ctx = Object.assign({}, globalContext);
  
      for (const { component } of this.imports) {
        Object.assign(ctx, await component.context(ctx));
      }
  
      if (context) {
        debug(`building ${context.namespace} context`);

        if (!ctx[context.namespace]) {
          ctx[context.namespace] = {};
        }

        if (ctx[context.namespace]) {

        }
  
        Object.assign(ctx[context.namespace], await context.factory.call(this, ctx));
      }
  
      return ctx;
    };

  }

  overrideDataSources(dataSources: DataSourceMap, context: any): void {
    Object.assign(dataSources, this._dataSourceInjection(context));
    return;
  }

  get name(): string {
    return this.constructor.name;
  }

  get schema() : GraphQLSchema {
    if (this._schema) {
      return this._schema;
    }

    let makeSchema: (schemaConfig: any) => GraphQLSchema = undefined;

    if (this._federation) {
      makeSchema = (schemaConfig): GraphQLSchema => {
        return buildFederatedSchema(schemaConfig);
      };
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
      this._schema = transformSchema(this._schema, this._transforms);
    }

    if (this._mocks !== undefined && typeof this._mocks === 'boolean' && this._mocks === true) {
      debug(`adding default mocks to the schema for ${this.name}`);
      // if mocks are a boolean support simply applying default mocks
      this._schema = addMocksToSchema({schema: this._schema, preserveResolvers: true});
    }
    else if (this._mocks !== undefined && typeof this._mocks === 'object') {
      debug(`adding custom mocks to the schema for ${this.name}`);
      // else if mocks is an object, that means the user provided
      // custom mocks, with which we pass them to addMocksToSchema so they are applied
      this._schema = addMocksToSchema({schema: this._schema, mocks: this._mocks, preserveResolvers: true});
    }

    if (this._pruneSchema) {
      debug(`pruning the schema for ${this.name}`);
      this._schema = pruneSchema(this._schema, this._pruneSchemaOptions);
    }

    debug(`created schema for ${this.name}`);

    return this._schema;
  }

  get context(): IContextWrapper {
    const middleware = [];
    const contextFunction = this._context;
  
    const dataSourceInject = (context: any = {}): DataSourceMap => {
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
  
      const dataSources = {};
  
      // Inject data sources
      for (const dataSource of this._dataSources) {
        dataSources[dataSource.name] = intercept(dataSource, context);
      }
  
      // Override data sources
      for (const dataSourceOverride of this._dataSourceOverrides) {
        dataSources[dataSourceOverride.name] = intercept(dataSourceOverride, context);
      }
  
      return dataSources;
    };

    const context = async (context): Promise<any> => {
      debug(`building root context`);
  
      for (let { name, fn } of middleware) {
        debug(`applying ${name} middleware`);
        context = await fn(context);
      }
  
      const componentContext = await contextFunction(context);
  
      const globalContext = {
        ...context,
        ...componentContext
      };
      
      globalContext.dataSources = dataSourceInject(globalContext);
      
      return globalContext;
    };
  
    context.use = function (name, fn) {
      if (typeof name === 'function') {
        fn = name;
        name = 'unknown';
      }
      debug(`adding ${name} middleware`);
      middleware.push({ name, fn });
    };
  
    return context;
  }

  get types(): TypeSource {
    return this._types;
  }

  get resolvers(): IResolvers {
    return this._resolvers;
  }

  get imports(): IGraphQLComponentConfigObject[] {
    return this._imports;
  }

  get dataSources(): IDataSource[] {
    return this._dataSources;
  }

  set federation(flag) {
    this._federation = flag;
  }

  get federation(): boolean {
    return this._federation;
  }

  get dataSourceInjection(): DataSourceInjectionFunction {
    return this._dataSourceInjection;
  }

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

const transformSchema = function (schema: GraphQLSchema, transforms: SchemaMapper[]) {
  const functions = {};
  const mapping = {};

  for (const transform of transforms) {
      for (const [key, fn] of Object.entries(transform)) {
        if (!mapping[key]) {
          functions[key] = [];          
          mapping[key] = function  (arg) {
            while (functions[key].length) {
              const mapper = functions[key].shift();
              arg = mapper(arg);
              if (!arg) {
                break;
              }
            }
            return arg;
          }
        }
        functions[key].push(fn);
      }
  }

  return mapSchema(schema, mapping);
}