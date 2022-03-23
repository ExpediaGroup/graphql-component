
const debug = require('debug')('graphql-component');

import { buildFederatedSchema } from '@apollo/federation';
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLSchema } from 'graphql';

import {
  stitchSchemas,
  mergeTypeDefs,
  addMocksToSchema,
  makeExecutableSchema,
  pruneSchema,
  SchemaDirectiveVisitor,
  IResolvers,
  DirectiveUseMap,
  SubschemaConfig,
  PruneSchemaOptions,
  ITypedef,
  IMocks
} from 'graphql-tools';

export type ResolverFunction = (_: any, args: any, ctx: any, info: GraphQLResolveInfo) => any;

export interface IGraphQLComponentConfigObject {
  component: IGraphQLComponent;
  configuration?: SubschemaConfig; //TODO README
}

export type ContextFunction = ((ctx: any) => any);

export interface IDataSource {
  name: string
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
  types?: ITypedef | ITypedef[]
  resolvers?: IResolvers<any, any>;
  mocks?: IMocks;
  directives?: DirectiveUseMap;
  imports?: (IGraphQLComponent | IGraphQLComponentConfigObject)[];
  context?: IContextConfig;
  dataSources?: any[];
  dataSourceOverrides?: any;
  pruneSchema?: boolean;
  pruneSchemaOptions?: PruneSchemaOptions
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
  overrideDataSources: (dataSources: DataSourceMap, context: any) => void
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
  _pruneSchemaOptions: PruneSchemaOptions
  _federation: boolean;
  _dataSourceInjection: DataSourceInjectionFunction;

  constructor({
    types,
    resolvers,
    mocks,
    directives,
    imports,
    context,
    dataSources,
    dataSourceOverrides,
    pruneSchema,
    pruneSchemaOptions,
    federation  
  }: IGraphQLComponentOptions) {
    
    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = bindResolvers(this, resolvers);
    
    this._mocks = mocks;
    
    this._directives = directives;

    this._federation = federation;

    this._dataSources = dataSources;

    this._dataSourceOverrides = dataSourceOverrides;

    this._pruneSchema = pruneSchema;

    this._pruneSchemaOptions = pruneSchemaOptions;

    this._imports = imports && imports.length > 0 ? imports.map((i) => {
      // check for a GraphQLComponent instance to construct a configuration object from it
      if (i instanceof GraphQLComponent) {
        // if the importing component (ie. this component) has federation set to true - set federation: true
        // for all of its imported components
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


    this._context = async (): Promise<any> => {
      const ctx = {};
  
      for (const { component } of this.imports) {
        Object.assign(ctx, await component.context(context));
      }
  
      if (context) {
        debug(`building ${context.namespace} context`);
        
        if (!ctx[context.namespace]) {
          ctx[context.namespace] = {};
        }
  
        Object.assign(ctx[context.namespace], await context.factory.call(this, context));
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
        const schema = buildFederatedSchema(schemaConfig);

        // allows a federated schema to have custom directives using the old class based directive implementation
        if (this._directives) {
          SchemaDirectiveVisitor.visitSchemaDirectives(schema, this._directives);
        }
        
        return schema;
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
        schemaDirectives: this._directives
      });
    }
    else {
      const schemaConfig = {
        typeDefs: mergeTypeDefs(this._types),
        resolvers: this._resolvers,
        schemaDirectives: this._directives
      }

      this._schema = makeSchema(schemaConfig);
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

  get context() : IContextWrapper {
    const middleware = [];
    const contextFunction = this.context;
    
    //TODO: FIX THIS 
    // const dataSourceInject = (context: any = {}) : DataSourceMap => {
    //   const intercept = (instance: IDataSource, context: any) => {
    //     debug(`intercepting ${instance.constructor.name}`);

    //     return new Proxy(instance, {
    //       get(target, key) {
    //         if (typeof target[key] !== 'function' || key === instance.constructor.name) {
    //           return target[key];
    //         }
    //         const original = target[key];

    //         return function (...args) {
    //           return original.call(instance, context, ...args);
    //         };
    //       }
    //     });
    //   };
      
    //   const dataSources = {};
  
    //   for (const { component } of this.imports) {
    //     component.overrideDataSources(dataSources, dataSourceInject(context));
    //   }
  
    //   for (const override of this._dataSourceOverrides) {
    //     debug(`overriding datasource ${override.constructor.name}`);
    //     dataSources[override.constructor.name] = intercept(override, context);
    //   }
  
    //   if (this.dataSources && this.dataSources.length > 0) {
    //     for (const dataSource of this.dataSources) {
    //       const name = dataSource.constructor.name;
    //       if (!dataSources[name]) {
    //         dataSources[name] = intercept(dataSource, context);
    //       }
    //     }
    //   }
  
    //   return dataSources;
    // };

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

  get types(): ITypedef[] {
    return this._types;
  }

  get resolvers(): IResolvers {
    return this._resolvers;
  }

  get imports(): IGraphQLComponentConfigObject[] {
    return this._imports;
  }

  get directives(): DirectiveUseMap {
    return this._directives;
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
}