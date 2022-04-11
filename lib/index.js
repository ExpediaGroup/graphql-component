'use strict';

const { buildFederatedSchema } = require('@apollo/federation');

const {
  stitchSchemas,
  delegateToSchema,
  mergeTypeDefs,
  addMocksToSchema,
  makeExecutableSchema,
  SchemaDirectiveVisitor
} = require('graphql-tools');

const { pruneSchema } = require('./prune');

const { bindResolvers } = require('./resolvers');
const { wrapContext, createContext } = require('./context');
const { createDataSourceInjection } = require('./datasource');
const { exclusions } = require('./transforms');

const debug = require('debug')('graphql-component:schema');

const GraphQLComponentUtils = {
  pruneSchema(schema, options) {
    return pruneSchema(schema, options);
  },

  delegateToComponent(component, options) {
    options.schema = component.schema;
    // adapt v2 delegate options to v3 options to maintain backwards compatibility
    if (options.contextValue) {
      options.context = options.contextValue;
      delete options.contextValue;
    }

    if (options.targetRootField) {
      options.fieldName = options.targetRootField;
      delete options.targetRootField;
    }

    return delegateToSchema(options);
  }
};

class GraphQLComponent {
  constructor({
    types = [],
    resolvers = {},
    mocks = undefined,
    directives = {},
    federation = false,
    imports = [],
    context = undefined,
    dataSources = [],
    dataSourceOverrides = [],
    pruneSchema = false,
    pruneSchemaOptions = {}
  } = {}) {
    debug(`creating a GraphQLComponent instance`);

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = bindResolvers(this, resolvers);

    this._mocks = mocks;

    this._directives = directives;

    this._federation = federation;

    this._imports = imports && imports.length > 0 ? imports.map((i) => {
      // check for a GraphQLComponent instance to construct a configuration object from it
      if (i instanceof GraphQLComponent) {
        // if the importing component (ie. this component) has federation set to true - set federation: true
        // for all of its imported components
        if (this._federation === true) {
          i.federation = true;
        }
        return { component: i, exclude: [] };
      }
      // check for a configuration object and simply return it
      else if (((typeof i === 'function') || (typeof i === 'object')) && i.component) {
        // if the importing component (ie. this component) has federation set to true - set federation: true
        // for all of its imported components
        if (this._federation === true) {
          i.component.federation = true;
        }
        return i;
      }
      throw new Error(`import in ${this.name} not an instance of GraphQLComponent or component configuration object: { component: <GraphQLComponent instance>, exclude: [] }`);
    }) : [];

    this._context = createContext(this, context);

    this._dataSources = dataSources;

    this._pruneSchema = pruneSchema;

    this._pruneSchemaOptions = pruneSchemaOptions;

    this._schema = undefined;

    this._dataSourceInjection = createDataSourceInjection(this, dataSourceOverrides);

    this.graphqlTools = require('graphql-tools');
  }

  get name() {
    return this.constructor.name;
  }

  static get utils() {
    return GraphQLComponentUtils;
  }

  static delegateToComponent(component, options) {
    console.warn('Deprecated: use GraphQLComponent.utils.delegateToComponent instead.');
    return GraphQLComponent.utils.delegateToComponent(component, options);
  }
  
  _getMakeSchemaFunction() {
    if (this._federation) {
      return (schemaConfig) => {
        const schema = buildFederatedSchema(schemaConfig);

        // allows a federated schema to have custom directives using the old class based directive implementation
        if (this._directives) {
          SchemaDirectiveVisitor.visitSchemaDirectives(schema, this._directives);
        }
        
        return schema;
      };
    }
    
    return makeExecutableSchema;
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    if (this._imports.length > 0) {
      // iterate through the imports and construct subschema configuration objects
      const subschemas = this._imports.map((imp) => {
        const { component, exclude } = imp;
        return {
          schema: component.schema,
          transforms: exclusions(exclude)
        }
      });

      // construct an aggregate schema from the schemas of imported
      // components and this component's types/resolvers (if present)
      this._schema = stitchSchemas({
        subschemas,
        typeDefs: this._types,
        resolvers: this._resolvers,
        schemaDirectives: this._directives,
        mergeDirectives: true
      });
    }
    else {
      const schemaConfig = {
        typeDefs: mergeTypeDefs(this._types),
        resolvers: this._resolvers,
        schemaDirectives: this._directives
      }
      
      const makeSchema = this._getMakeSchemaFunction();

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
      this._schema = pruneSchema(this._schema, this._pruneSchemaOptions);
    }

    debug(`created schema for ${this.name}`);

    return this._schema;
  }

  get context() {
    return wrapContext(this);
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
}

module.exports = GraphQLComponent;
