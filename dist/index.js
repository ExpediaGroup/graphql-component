"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require('debug')('graphql-component');
const federation_1 = require("@apollo/federation");
const graphql_1 = require("graphql");
const graphql_tools_1 = require("graphql-tools");
class GraphQLComponent {
    _schema;
    _types;
    _resolvers;
    _mocks;
    _directives;
    _imports;
    _context;
    _dataSources;
    _dataSourceOverrides;
    _pruneSchema;
    _pruneSchemaOptions;
    _federation;
    _dataSourceInjection;
    constructor({ types, resolvers, mocks, directives, imports, context, dataSources, dataSourceOverrides, pruneSchema, pruneSchemaOptions, federation }) {
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
                const schema = (0, federation_1.buildFederatedSchema)(schemaConfig);
                // allows a federated schema to have custom directives using the old class based directive implementation
                if (this._directives) {
                    graphql_tools_1.SchemaDirectiveVisitor.visitSchemaDirectives(schema, this._directives);
                }
                return schema;
            };
        }
        else {
            makeSchema = graphql_tools_1.makeExecutableSchema;
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
            this._schema = (0, graphql_tools_1.stitchSchemas)({
                subschemas,
                typeDefs: this._types,
                resolvers: this._resolvers,
                schemaDirectives: this._directives
            });
        }
        else {
            const schemaConfig = {
                typeDefs: (0, graphql_tools_1.mergeTypeDefs)(this._types),
                resolvers: this._resolvers,
                schemaDirectives: this._directives
            };
            this._schema = makeSchema(schemaConfig);
        }
        if (this._mocks !== undefined && typeof this._mocks === 'boolean' && this._mocks === true) {
            debug(`adding default mocks to the schema for ${this.name}`);
            // if mocks are a boolean support simply applying default mocks
            this._schema = (0, graphql_tools_1.addMocksToSchema)({ schema: this._schema, preserveResolvers: true });
        }
        else if (this._mocks !== undefined && typeof this._mocks === 'object') {
            debug(`adding custom mocks to the schema for ${this.name}`);
            // else if mocks is an object, that means the user provided
            // custom mocks, with which we pass them to addMocksToSchema so they are applied
            this._schema = (0, graphql_tools_1.addMocksToSchema)({ schema: this._schema, mocks: this._mocks, preserveResolvers: true });
        }
        if (this._pruneSchema) {
            debug(`pruning the schema for ${this.name}`);
            this._schema = (0, graphql_tools_1.pruneSchema)(this._schema, this._pruneSchemaOptions);
        }
        debug(`created schema for ${this.name}`);
        return this._schema;
    }
    get context() {
        const middleware = [];
        const contextFunction = this.context;
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
            for (const { component } of this.imports) {
                component.overrideDataSources(dataSources, context);
            }
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
    get directives() {
        return this._directives;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUVwRCxtREFBMEQ7QUFDMUQscUNBQStFO0FBRS9FLGlEQWF1QjtBQXVEdkIsTUFBcUIsZ0JBQWdCO0lBQ25DLE9BQU8sQ0FBZ0I7SUFDdkIsTUFBTSxDQUFhO0lBQ25CLFVBQVUsQ0FBdUI7SUFDakMsTUFBTSxDQUFTO0lBQ2YsV0FBVyxDQUFrQjtJQUM3QixRQUFRLENBQWtDO0lBQzFDLFFBQVEsQ0FBa0I7SUFDMUIsWUFBWSxDQUFnQjtJQUM1QixvQkFBb0IsQ0FBZ0I7SUFDcEMsWUFBWSxDQUFVO0lBQ3RCLG1CQUFtQixDQUFvQjtJQUN2QyxXQUFXLENBQVU7SUFDckIsb0JBQW9CLENBQThCO0lBRWxELFlBQVksRUFDVixLQUFLLEVBQ0wsU0FBUyxFQUNULEtBQUssRUFDTCxVQUFVLEVBQ1YsT0FBTyxFQUNQLE9BQU8sRUFDUCxXQUFXLEVBQ1gsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsVUFBVSxFQUNlO1FBRXpCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJELElBQUksQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUVqRCxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztRQUVwQixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUU5QixJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUU5QixJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQztRQUVoQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsbUJBQW1CLENBQUM7UUFFaEQsSUFBSSxDQUFDLFlBQVksR0FBRyxXQUFXLENBQUM7UUFFaEMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGtCQUFrQixDQUFDO1FBRTlDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDaEUsb0ZBQW9GO1lBQ3BGLElBQUksQ0FBQyxZQUFZLGdCQUFnQixFQUFFO2dCQUNqQyxvR0FBb0c7Z0JBQ3BHLHFDQUFxQztnQkFDckMsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksRUFBRTtvQkFDN0IsQ0FBQyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7aUJBQ3JCO2dCQUVELE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUM7YUFDekI7aUJBQ0k7Z0JBQ0gsTUFBTSxtQkFBbUIsR0FBRyxDQUFrQyxDQUFDO2dCQUUvRCxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO29CQUM3QixtQkFBbUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztpQkFDakQ7Z0JBQ0QsT0FBTyxtQkFBbUIsQ0FBQzthQUM1QjtRQUNILENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFHUixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssSUFBa0IsRUFBRTtZQUN2QyxNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUM7WUFFZixLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUN4QyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUN0RDtZQUVELElBQUksT0FBTyxFQUFFO2dCQUNYLEtBQUssQ0FBQyxZQUFZLE9BQU8sQ0FBQyxTQUFTLFVBQVUsQ0FBQyxDQUFDO2dCQUUvQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRTtvQkFDM0IsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUM7aUJBQzdCO2dCQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2xGO1lBRUQsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDLENBQUM7SUFFSixDQUFDO0lBRUQsbUJBQW1CLENBQUMsV0FBMEIsRUFBRSxPQUFZO1FBQzFELE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQy9ELE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBSSxJQUFJO1FBQ04sT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztJQUMvQixDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1IsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztTQUNyQjtRQUVELElBQUksVUFBVSxHQUF5QyxTQUFTLENBQUM7UUFFakUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLFVBQVUsR0FBRyxDQUFDLFlBQVksRUFBaUIsRUFBRTtnQkFDM0MsTUFBTSxNQUFNLEdBQUcsSUFBQSxpQ0FBb0IsRUFBQyxZQUFZLENBQUMsQ0FBQztnQkFFbEQseUdBQXlHO2dCQUN6RyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7b0JBQ3BCLHNDQUFzQixDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7aUJBQ3hFO2dCQUVELE9BQU8sTUFBTSxDQUFDO1lBQ2hCLENBQUMsQ0FBQztTQUNIO2FBQ0k7WUFDSCxVQUFVLEdBQUcsb0NBQW9CLENBQUM7U0FDbkM7UUFFRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM1Qiw0RUFBNEU7WUFDNUUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDM0MsTUFBTSxFQUFFLFNBQVMsRUFBRSxhQUFhLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDO2dCQUU5QyxPQUFPO29CQUNMLE1BQU0sRUFBRSxTQUFTLENBQUMsTUFBTTtvQkFDeEIsR0FBRyxhQUFhO2lCQUNqQixDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7WUFFSCw2REFBNkQ7WUFDN0QsK0RBQStEO1lBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSw2QkFBYSxFQUFDO2dCQUMzQixVQUFVO2dCQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDckIsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVO2dCQUMxQixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsV0FBVzthQUNuQyxDQUFDLENBQUM7U0FDSjthQUNJO1lBQ0gsTUFBTSxZQUFZLEdBQUc7Z0JBQ25CLFFBQVEsRUFBRSxJQUFBLDZCQUFhLEVBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDcEMsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVO2dCQUMxQixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsV0FBVzthQUNuQyxDQUFBO1lBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDekM7UUFFRCxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUyxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7WUFDekYsS0FBSyxDQUFDLDBDQUEwQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM3RCwrREFBK0Q7WUFDL0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLGdDQUFnQixFQUFDLEVBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztTQUNsRjthQUNJLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRTtZQUNyRSxLQUFLLENBQUMseUNBQXlDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzVELDJEQUEyRDtZQUMzRCxnRkFBZ0Y7WUFDaEYsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFBLGdDQUFnQixFQUFDLEVBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztTQUN0RztRQUVELElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNyQixLQUFLLENBQUMsMEJBQTBCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSwyQkFBVyxFQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7U0FDcEU7UUFFRCxLQUFLLENBQUMsc0JBQXNCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRXpDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1QsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFckMsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLFVBQWUsRUFBRSxFQUFrQixFQUFFO1lBQzdELE1BQU0sU0FBUyxHQUFHLENBQUMsUUFBcUIsRUFBRSxPQUFZLEVBQUUsRUFBRTtnQkFDeEQsS0FBSyxDQUFDLGdCQUFnQixRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBRW5ELE9BQU8sSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO29CQUN6QixHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUc7d0JBQ2IsSUFBSSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxVQUFVLElBQUksR0FBRyxLQUFLLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFOzRCQUMxRSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzt5QkFDcEI7d0JBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUU3QixPQUFPLFVBQVUsR0FBRyxJQUFJOzRCQUN0QixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO3dCQUNuRCxDQUFDLENBQUM7b0JBQ0osQ0FBQztpQkFDRixDQUFDLENBQUM7WUFDTCxDQUFDLENBQUM7WUFFRixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7WUFFdkIsS0FBSyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDeEMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUNyRDtZQUVELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFO2dCQUNoRCxLQUFLLENBQUMseUJBQXlCLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDNUQsV0FBVyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUN2RTtZQUVELElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ25ELEtBQUssTUFBTSxVQUFVLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtvQkFDekMsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7b0JBQ3pDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3RCLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUNwRDtpQkFDRjthQUNGO1lBRUQsT0FBTyxXQUFXLENBQUM7UUFDckIsQ0FBQyxDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUFFLE9BQU8sRUFBZ0IsRUFBRTtZQUM5QyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUUvQixLQUFLLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksVUFBVSxFQUFFO2dCQUNuQyxLQUFLLENBQUMsWUFBWSxJQUFJLGFBQWEsQ0FBQyxDQUFDO2dCQUNyQyxPQUFPLEdBQUcsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDN0I7WUFFRCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRXhELE1BQU0sYUFBYSxHQUFHO2dCQUNwQixHQUFHLE9BQU87Z0JBQ1YsR0FBRyxnQkFBZ0I7YUFDcEIsQ0FBQztZQUVGLGFBQWEsQ0FBQyxXQUFXLEdBQUcsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFNUQsT0FBTyxhQUFhLENBQUM7UUFDdkIsQ0FBQyxDQUFDO1FBRUYsT0FBTyxDQUFDLEdBQUcsR0FBRyxVQUFVLElBQUksRUFBRSxFQUFFO1lBQzlCLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO2dCQUM5QixFQUFFLEdBQUcsSUFBSSxDQUFDO2dCQUNWLElBQUksR0FBRyxTQUFTLENBQUM7YUFDbEI7WUFDRCxLQUFLLENBQUMsVUFBVSxJQUFJLGFBQWEsQ0FBQyxDQUFDO1lBQ25DLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNoQyxDQUFDLENBQUM7UUFFRixPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsSUFBSSxLQUFLO1FBQ1AsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLFNBQVM7UUFDWCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUVELElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN2QixDQUFDO0lBRUQsSUFBSSxVQUFVO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRCxJQUFJLFdBQVc7UUFDYixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDM0IsQ0FBQztJQUVELElBQUksVUFBVSxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDMUIsQ0FBQztJQUVELElBQUksVUFBVTtRQUNaLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUMxQixDQUFDO0lBRUQsSUFBSSxtQkFBbUI7UUFDckIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDbkMsQ0FBQztDQUVGO0FBNVJELG1DQTRSQztBQUdEOzs7Ozs7Ozs7OztHQVdHO0FBQ0YsTUFBTSxPQUFPLEdBQUcsVUFBVSxVQUFrQixFQUFFLFNBQWlCLEVBQUUsT0FBeUI7SUFDekYsTUFBTSxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUU3QixPQUFPLFNBQVMsaUJBQWlCLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSTtRQUN0RCxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNoRCxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFFOUMsS0FBSyxDQUFDLGFBQWEsVUFBVSxJQUFJLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFOUMsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVqQyxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDekIsS0FBSyxDQUFDLG9DQUFvQyxVQUFVLElBQUksU0FBUyxFQUFFLENBQUMsQ0FBQztZQUNyRSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNwQjtRQUVELElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDWCxNQUFNLEdBQUcsRUFBRSxDQUFDO1NBQ2I7UUFFRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFL0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQztRQUVyQixNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUU1QixLQUFLLENBQUMsVUFBVSxVQUFVLElBQUksU0FBUyxFQUFFLENBQUMsQ0FBQztRQUUzQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDLENBQUM7QUFDSixDQUFDLENBQUM7QUFFRjs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxhQUFhLEdBQUcsVUFBVSxXQUE4QixFQUFFLFlBQXdCLEVBQUU7SUFDeEYsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDO0lBRTFCLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQ3RELDhEQUE4RDtRQUM5RCxJQUFJLE1BQU0sWUFBWSwyQkFBaUIsRUFBRTtZQUN2QyxLQUFLLENBQUMsZUFBZSxJQUFJLG1CQUFtQixJQUFJLGdEQUFnRCxDQUFDLENBQUE7WUFDakcsY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUM5QixTQUFTO1NBQ1Y7UUFFRCxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pCLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7U0FDM0I7UUFFRCxLQUFLLE1BQU0sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN0RCxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDNUMsS0FBSyxDQUFDLFlBQVksSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7Z0JBQ25DLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7YUFDaEY7aUJBQ0k7Z0JBQ0gseUNBQXlDO2dCQUN6QyxJQUFJLE9BQU8sUUFBUSxLQUFLLFVBQVUsRUFBRTtvQkFDbEMsS0FBSyxDQUFDLFdBQVcsSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQ2xDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2lCQUMxRDtxQkFDSTtvQkFDSCxLQUFLLENBQUMsZUFBZSxJQUFJLElBQUksS0FBSyxVQUFVLEtBQUssOEJBQThCLENBQUMsQ0FBQztvQkFDakYsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLFFBQVEsQ0FBQztpQkFDeEM7YUFDRjtTQUNGO0tBQ0Y7SUFFRCxPQUFPLGNBQWMsQ0FBQztBQUN4QixDQUFDLENBQUEifQ==