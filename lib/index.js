'use strict';

const { buildFederatedSchema } = require('@apollo/federation');
const { mergeResolvers, mergeTypeDefs } = require('@graphql-tools/merge');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { addMocksToSchema } = require('@graphql-tools/mock');
const { SchemaDirectiveVisitor } = require('@graphql-tools/utils');
const { bindResolvers } = require('./resolvers');
const { buildDependencyTree } = require('./imports');
const { wrapContext, createContext } = require('./context');
const { createDataSourceInjection } = require('./datasource');
const { delegateToComponent } = require('./delegate');
const cuid = require('cuid');

const debug = require('debug')('graphql-component:schema');

class GraphQLComponent {
  constructor({
    types = [],
    resolvers = {},
    imports = [],
    dataSources = [],
    mocks = undefined,
    directives = {},
    context = undefined,
    useMocks = false,
    preserveResolvers = false,
    dataSourceOverrides = [],
    federation = false
  } = {}) {
    debug(`creating component`);
    
    //This is really only used for avoiding directive collisions
    this._id = cuid().slice(12);

    this._schema = undefined;

    this._federation = federation;

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = bindResolvers(this, resolvers);

    this._imports = imports && imports.length > 0 ? imports.map((i) => GraphQLComponent.isComponent(i) ? { component: i, exclude: [] } : i) : [];

    this._dataSources = dataSources;

    this._directives = directives;

    this._context = createContext(this, context);

    this._dataSourceInjection = createDataSourceInjection(this, dataSourceOverrides);

    this._useMocks = useMocks;

    this._mocks = mocks;

    this._preserveResolvers = preserveResolvers;
  }

  get name() {
    return this.constructor.name;
  }
  
  get id() {
    return this._id;
  }

  static isComponent(check) {
    return check && check._types && check._resolvers && check._imports;
  }

  static delegateToComponent(...args) {
    return delegateToComponent(...args);
  }

  makeFederatedSchemaWithDirectives({typeDefs, resolvers, schemaDirectives}) {
    const federatedSchema = buildFederatedSchema({
      typeDefs,
      resolvers
    });

    // Add any custom schema directives
    if (schemaDirectives) {
      SchemaDirectiveVisitor.visitSchemaDirectives(federatedSchema, schemaDirectives);
    }

    return federatedSchema;
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    const { importedTypes, importedResolvers, importedMocks, importedDirectives } = buildDependencyTree(this);

    const typeDefs = mergeTypeDefs([...importedTypes]);
    const resolvers = mergeResolvers([...importedResolvers]);
    const schemaDirectives = importedDirectives;

    const makeSchema = this._federation ? this.makeFederatedSchemaWithDirectives : makeExecutableSchema;

    let schema = makeSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveResolvers=${this._preserveResolvers}`);

      schema = addMocksToSchema({schema, mocks: Object.assign({}, ...importedMocks), preserveResolvers: this._preserveResolvers});
    }

    this._schema = schema;

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

  get mocks() {
    return this._mocks;
  }

  get directives() {
    return this._directives;
  }

  get dataSources() {
    return this._dataSources;
  }
}

module.exports = GraphQLComponent;
