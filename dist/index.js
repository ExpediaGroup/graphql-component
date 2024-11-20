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
            return ctx;
        };
    }
    get context() {
        const contextFn = async (context) => {
            debug(`building root context`);
            for (let { name, fn } of contextFn._middleware) {
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
        contextFn.use = function (name, fn) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVwRCxtREFBMEQ7QUFDMUQscUNBQStFO0FBRS9FLGdEQUFxRDtBQUNyRCxnREFPOEI7QUFDOUIsa0RBQTZEO0FBQzdELGtEQUFzRDtBQUN0RCw4Q0FBK0Q7QUEyRC9ELE1BQXFCLGdCQUFnQjtJQUNuQyxPQUFPLENBQWdCO0lBQ3ZCLE1BQU0sQ0FBYTtJQUNuQixVQUFVLENBQXVCO0lBQ2pDLE1BQU0sQ0FBbUI7SUFDekIsUUFBUSxDQUFrQztJQUMxQyxRQUFRLENBQWtCO0lBQzFCLFlBQVksQ0FBZ0I7SUFDNUIsb0JBQW9CLENBQWdCO0lBQ3BDLFlBQVksQ0FBVTtJQUN0QixtQkFBbUIsQ0FBb0I7SUFDdkMsV0FBVyxDQUFVO0lBQ3JCLHdCQUF3QixDQUE4QjtJQUN0RCxXQUFXLENBQWdCO0lBRTNCLFlBQVksRUFDVixLQUFLLEVBQ0wsU0FBUyxFQUNULEtBQUssRUFDTCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFdBQVcsRUFDWCxtQkFBbUIsRUFDbkIsV0FBVyxFQUNYLGtCQUFrQixFQUNsQixVQUFVLEVBQ1YsVUFBVSxFQUNlO1FBRXpCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJELElBQUksQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUVqRCxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUVwQixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFH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