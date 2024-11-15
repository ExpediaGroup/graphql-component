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
    _dataSourceInjection;
    _transforms;
    constructor({ types, resolvers, mocks, imports, context, dataSources, dataSourceOverrides, pruneSchema, pruneSchemaOptions, federation, transforms }) {
        this._types = Array.isArray(types) ? types : [types];
        this._resolvers = bindResolvers(this, resolvers);
        this._mocks = mocks;
        this._federation = federation;
        this._transforms = transforms;
        this._dataSources = dataSources || [];
        this._dataSourceOverrides = dataSourceOverrides || [];
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
                const importConfiguration = i;
                if (this._federation === true) {
                    importConfiguration.component.federation = true;
                }
                return importConfiguration;
            }
        }) : [];
        this._context = async () => {
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
    overrideDataSources(dataSources, context) {
        Object.assign(dataSources, this._dataSourceInjection(context));
        return;
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
                return (0, federation_1.buildFederatedSchema)(schemaConfig); //TODO: custom schema directives (alternative to SchemaDirectiveVisitor)
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
        //TODO: add documentation
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
    get context() {
        const middleware = [];
        const contextFunction = this._context;
        //TODO: FIX THIS 
        const dataSourceInject = (context = {}) => {
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
            const dataSources = {};
            // for (const { component } of this.imports) {
            //   component.overrideDataSources(dataSources, dataSourceInject(context));
            // }
            for (const override of this._dataSourceOverrides) {
                debug(`overriding datasource ${override.constructor.name}`);
                dataSources[override.constructor.name] = intercept(override, context);
            }
            if (this.dataSources && this.dataSources.length > 0) {
                for (const dataSource of this.dataSources) {
                    const name = dataSource.constructor.name;
                    if (!dataSources[name]) {
                        dataSources[name] = intercept(dataSource, context);
                    }
                }
            }
            return dataSources;
        };
        const context = async (context) => {
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
    set federation(flag) {
        this._federation = flag;
    }
    get federation() {
        return this._federation;
    }
    get dataSourceInjection() {
        return this._dataSourceInjection;
    }
}
exports.default = GraphQLComponent;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVwRCxtREFBMEQ7QUFDMUQscUNBQStFO0FBRS9FLGdEQUFxRDtBQUNyRCxnREFPOEI7QUFDOUIsa0RBQTZEO0FBQzdELGtEQUFzRDtBQUN0RCw4Q0FBK0Q7QUEyRC9ELE1BQXFCLGdCQUFnQjtJQUNuQyxPQUFPLENBQWdCO0lBQ3ZCLE1BQU0sQ0FBYTtJQUNuQixVQUFVLENBQXVCO0lBQ2pDLE1BQU0sQ0FBUztJQUNmLFFBQVEsQ0FBa0M7SUFDMUMsUUFBUSxDQUFrQjtJQUMxQixZQUFZLENBQWdCO0lBQzVCLG9CQUFvQixDQUFnQjtJQUNwQyxZQUFZLENBQVU7SUFDdEIsbUJBQW1CLENBQW9CO0lBQ3ZDLFdBQVcsQ0FBVTtJQUNyQixvQkFBb0IsQ0FBOEI7SUFDbEQsV0FBVyxDQUFnQjtJQUUzQixZQUFZLEVBQ1YsS0FBSyxFQUNMLFNBQVMsRUFDVCxLQUFLLEVBQ0wsT0FBTyxFQUNQLE9BQU8sRUFDUCxXQUFXLEVBQ1gsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsVUFBVSxFQUNWLFVBQVUsRUFDZTtRQUV6QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVyRCxJQUFJLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFFcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUM7UUFFOUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxV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