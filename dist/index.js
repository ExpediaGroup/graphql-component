"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require('debug')('graphql-component');
const federation_1 = require("@apollo/federation");
const graphql_1 = require("graphql");
const merge_1 = require("@graphql-tools/merge");
const utils_1 = require("@graphql-tools/utils");
const schema_1 = require("@graphql-tools/schema");
const stitch_1 = require("@graphql-tools/stitch");
const mock_1 = require("@graphql-tools/mock");
class GraphQLComponent {
    _schema;
    _types;
    _resolvers;
    _mocks;
    _imports;
    _context;
    _dataSources;
    _dataSourceOverrides;
    _pruneSchema;
    _pruneSchemaOptions;
    _federation;
    _dataSourceContextInject;
    _transforms;
    constructor({ types, resolvers, mocks, imports, context, dataSources, dataSourceOverrides, pruneSchema, pruneSchemaOptions, federation, transforms }) {
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
        this._imports = imports && imports.length > 0 ? imports.map((i) => {
            if (i instanceof GraphQLComponent) {
                if (this._federation === true) {
                    i.federation = true;
                }
                return { component: i };
            }
            else {
                const importConfiguration = i;
                if (this._federation === true) {
                    importConfiguration.component.federation = true;
                }
                return importConfiguration;
            }
        }) : [];
        this._context = async (globalContext) => {
            const ctx = {
                dataSources: this._dataSourceContextInject({ globalContext })
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
            return ctx;
        };
    }
    get context() {
        const middleware = [];
        const contextFn = async (context) => {
            debug(`building root context`);
            for (let { name, fn } of middleware) {
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
        contextFn.use = function (name, fn) {
            if (typeof name === 'function') {
                fn = name;
                name = 'unknown';
            }
            debug(`adding ${name} middleware`);
            middleware.push({ name, fn });
        };
        return contextFn;
    }
    get name() {
        return this.constructor.name;
    }
    get schema() {
        if (this._schema) {
            return this._schema;
        }
        let makeSchema = undefined;
        if (this._federation) {
            makeSchema = (schemaConfig) => {
                return (0, federation_1.buildFederatedSchema)(schemaConfig);
            };
        }
        else {
            makeSchema = schema_1.makeExecutableSchema;
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
            this._schema = (0, stitch_1.stitchSchemas)({
                subschemas,
                typeDefs: this._types,
                resolvers: this._resolvers,
                mergeDirectives: true
            });
        }
        else {
            const schemaConfig = {
                typeDefs: (0, merge_1.mergeTypeDefs)(this._types),
                resolvers: this._resolvers
            };
            this._schema = makeSchema(schemaConfig);
        }
        if (this._transforms) {
            this._schema = transformSchema(this._schema, this._transforms);
        }
        if (this._mocks !== undefined && typeof this._mocks === 'boolean' && this._mocks === true) {
            debug(`adding default mocks to the schema for ${this.name}`);
            // if mocks are a boolean support simply applying default mocks
            this._schema = (0, mock_1.addMocksToSchema)({ schema: this._schema, preserveResolvers: true });
        }
        else if (this._mocks !== undefined && typeof this._mocks === 'object') {
            debug(`adding custom mocks to the schema for ${this.name}`);
            // else if mocks is an object, that means the user provided
            // custom mocks, with which we pass them to addMocksToSchema so they are applied
            this._schema = (0, mock_1.addMocksToSchema)({ schema: this._schema, mocks: this._mocks, preserveResolvers: true });
        }
        if (this._pruneSchema) {
            debug(`pruning the schema for ${this.name}`);
            this._schema = (0, utils_1.pruneSchema)(this._schema, this._pruneSchemaOptions);
        }
        debug(`created schema for ${this.name}`);
        return this._schema;
    }
    get types() {
        return this._types;
    }
    get resolvers() {
        return this._resolvers;
    }
    get imports() {
        return this._imports;
    }
    get dataSources() {
        return this._dataSources;
    }
    get dataSourcesOverrides() {
        return this._dataSourceOverrides;
    }
    set federation(flag) {
        this._federation = flag;
    }
    get federation() {
        return this._federation;
    }
}
exports.default = GraphQLComponent;
/**
 * Wraps data sources with a proxy that intercepts calls to data source methods and injects the current context
 * @param {IDataSource[]} dataSources
 * @param {IDataSource[]} dataSourceOverrides
 * @returns {DataSourceInjectionFunction} a function that returns a map of data sources with methods that have been intercepted
 */
const createDataSourceContextInjector = (dataSources, dataSourceOverrides) => {
    const intercept = (instance, context) => {
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
        });
    };
    return (context = {}) => {
        const proxiedDataSources = {};
        // Inject data sources
        for (const dataSource of dataSources) {
            proxiedDataSources[dataSource.name] = intercept(dataSource, context);
        }
        // Override data sources
        for (const dataSourceOverride of dataSourceOverrides) {
            proxiedDataSources[dataSourceOverride.name] = intercept(dataSourceOverride, context);
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
const memoize = function (parentType, fieldName, resolve) {
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
const bindResolvers = function (bindContext, resolvers = {}) {
    const boundResolvers = {};
    for (const [type, fields] of Object.entries(resolvers)) {
        // dont bind an object that is an instance of a graphql scalar
        if (fields instanceof graphql_1.GraphQLScalarType) {
            debug(`not binding ${type}'s fields since ${type}'s fields are an instance of GraphQLScalarType`);
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
/**
 * Transforms a schema using the provided transforms
 * @param {GraphQLSchema} schema The schema to transform
 * @param {SchemaMapper[]} transforms An array of schema transforms
 * @returns {GraphQLSchema} The transformed schema
 */
const transformSchema = function (schema, transforms) {
    const functions = {};
    const mapping = {};
    for (const transform of transforms) {
        for (const [key, fn] of Object.entries(transform)) {
            if (!mapping[key]) {
                functions[key] = [];
                mapping[key] = function (arg) {
                    while (functions[key].length) {
                        const mapper = functions[key].shift();
                        arg = mapper(arg);
                        if (!arg) {
                            break;
                        }
                    }
                    return arg;
                };
            }
            functions[key].push(fn);
        }
    }
    return (0, utils_1.mapSchema)(schema, mapping);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVwRCxtREFBMEQ7QUFDMUQscUNBQStFO0FBRS9FLGdEQUFxRDtBQUNyRCxnREFPOEI7QUFDOUIsa0RBQTZEO0FBQzdELGtEQUFzRDtBQUN0RCw4Q0FBK0Q7QUEyRC9ELE1BQXFCLGdCQUFnQjtJQUNuQyxPQUFPLENBQWdCO0lBQ3ZCLE1BQU0sQ0FBYTtJQUNuQixVQUFVLENBQXVCO0lBQ2pDLE1BQU0sQ0FBUztJQUNmLFFBQVEsQ0FBa0M7SUFDMUMsUUFBUSxDQUFrQjtJQUMxQixZQUFZLENBQWdCO0lBQzVCLG9CQUFvQixDQUFnQjtJQUNwQyxZQUFZLENBQVU7SUFDdEIsbUJBQW1CLENBQW9CO0lBQ3ZDLFdBQVcsQ0FBVTtJQUNyQix3QkFBd0IsQ0FBOEI7SUFDdEQsV0FBVyxDQUFnQjtJQUUzQixZQUFZLEVBQ1YsS0FBSyxFQUNMLFNBQVMsRUFDVCxLQUFLLEVBQ0wsT0FBTyxFQUNQLE9BQU8sRUFDUCxXQUFXLEVBQ1gsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsVUFBVSxFQUNWLFVBQVUsRUFDZTtRQUV6QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCxJQUFJLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFFcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUM7UUFFOUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxV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