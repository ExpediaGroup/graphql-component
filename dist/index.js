"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const federation_1 = require("@apollo/federation");
const graphql_1 = require("graphql");
const merge_1 = require("@graphql-tools/merge");
const utils_1 = require("@graphql-tools/utils");
const schema_1 = require("@graphql-tools/schema");
const stitch_1 = require("@graphql-tools/stitch");
const mock_1 = require("@graphql-tools/mock");
const debug = (0, debug_1.default)('graphql-component');
/**
 * GraphQLComponent class for building modular GraphQL schemas
 * @template TContextType - The type of the context object
 * @implements {IGraphQLComponent}
 */
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
    _transformedSchema;
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
        this.validateConfig({ types, imports, mocks, federation });
    }
    get context() {
        const contextFn = async (context) => {
            debug(`building root context`);
            const middleware = contextFn._middleware || [];
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
        try {
            if (this._schema) {
                return this._schema;
            }
            let makeSchema;
            if (this._federation) {
                makeSchema = federation_1.buildFederatedSchema;
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
                this._schema = this.transformSchema(this._schema, this._transforms);
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
        catch (error) {
            debug(`Error creating schema for ${this.name}: ${error}`);
            throw new Error(`Failed to create schema for component ${this.name}: ${error.message}`);
        }
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
    dispose() {
        this._schema = null;
        this._types = null;
        this._resolvers = null;
        this._imports = null;
        this._dataSources = null;
        this._dataSourceOverrides = null;
    }
    transformSchema(schema, transforms) {
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
                    };
                }
                functions[key].push(fn);
            }
        }
        this._transformedSchema = (0, utils_1.mapSchema)(schema, mapping);
        return this._transformedSchema;
    }
    validateConfig(options) {
        if (options.federation && !options.types) {
            throw new Error('Federation requires type definitions');
        }
        if (options.mocks && typeof options.mocks !== 'boolean' && typeof options.mocks !== 'object') {
            throw new Error('mocks must be either boolean or object');
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrREFBZ0M7QUFDaEMsbURBQTBEO0FBQzFELHFDQUErRTtBQUUvRSxnREFBcUQ7QUFDckQsZ0RBTzhCO0FBQzlCLGtEQUE2RDtBQUM3RCxrREFBc0Q7QUFDdEQsOENBQStEO0FBRy9ELE1BQU0sS0FBSyxHQUFHLElBQUEsZUFBVyxFQUFDLG1CQUFtQixDQUFDLENBQUM7QUE2Ri9DOzs7O0dBSUc7QUFDSCxNQUFxQixnQkFBZ0I7SUFDbkMsT0FBTyxDQUFnQjtJQUN2QixNQUFNLENBQWE7SUFDbkIsVUFBVSxDQUFnQztJQUMxQyxNQUFNLENBQW1CO0lBQ3pCLFFBQVEsQ0FBa0M7SUFDMUMsUUFBUSxDQUFrQjtJQUMxQixZQUFZLENBQWdCO0lBQzVCLG9CQUFvQixDQUFnQjtJQUNwQyxZQUFZLENBQVU7SUFDdEIsbUJBQW1CLENBQW9CO0lBQ3ZDLFdBQVcsQ0FBVTtJQUNyQix3QkFBd0IsQ0FBOEI7SUFDdEQsV0FBVyxDQUFnQjtJQUNuQixrQkFBa0IsQ0FBZ0I7SUFFMUMsWUFBWSxFQUNWLEtBQUssRUFDTCxTQUFTLEVBQ1QsS0FBSyxFQUNMLE9BQU8sRUFDUCxPQUFPLEVBQ1AsV0FBVyxFQUNYLG1CQUFtQixFQUNuQixXQUFXLEVBQ1gsa0JBQWtCLEVBQ2xCLFVBQVUsRUFDVixVQUFVLEVBQ2U7UUFFekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckQsSUFBSSxDQUFDLFVBQVUsR0FBRyxhQUFhLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRWpELElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBRXBCLElBQUksQ0FBQyxXQUFXLEdB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