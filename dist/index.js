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
    get dataSourceOverrides() {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBRSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVwRCxtREFBMEQ7QUFDMUQscUNBQStFO0FBRS9FLGdEQUFxRDtBQUNyRCxnREFPOEI7QUFDOUIsa0RBQTZEO0FBQzdELGtEQUFzRDtBQUN0RCw4Q0FBK0Q7QUErRC9ELE1BQXFCLGdCQUFnQjtJQUNuQyxPQUFPLENBQWdCO0lBQ3ZCLE1BQU0sQ0FBYTtJQUNuQixVQUFVLENBQWdDO0lBQzFDLE1BQU0sQ0FBbUI7SUFDekIsUUFBUSxDQUFrQztJQUMxQyxRQUFRLENBQWtCO0lBQzFCLFlBQVksQ0FBZ0I7SUFDNUIsb0JBQW9CLENBQWdCO0lBQ3BDLFlBQVksQ0FBVTtJQUN0QixtQkFBbUIsQ0FBb0I7SUFDdkMsV0FBVyxDQUFVO0lBQ3JCLHdCQUF3QixDQUE4QjtJQUN0RCxXQUFXLENBQWdCO0lBRTNCLFlBQVksRUFDVixLQUFLLEVBQ0wsU0FBUyxFQUNULEtBQUssRUFDTCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFdBQVcsRUFDWCxtQkFBbUIsRUFDbkIsV0FBVyxFQUNYLGtCQUFrQixFQUNsQixVQUFVLEVBQ1YsVUFBVSxFQUNlO1FBRXpCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJELElBQUksQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUVqRCxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUVwQixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFH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