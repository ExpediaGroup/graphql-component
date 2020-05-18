'use strict';

const graphql = require('graphql');
const gql = require('graphql-tag');
const { buildFederatedSchema } = require('@apollo/federation');
const { makeExecutableSchema, addMockFunctionsToSchema, SchemaDirectiveVisitor } = require('graphql-tools');
const { mergeResolvers, mergeTypeDefs } = require('graphql-toolkit');
const { wrapResolvers, delegateToComponent } = require('./resolvers');
const { buildDependencyTree } = require('./imports');
const { wrapContext, createContext } = require('./context');
const { createDataSourceInjection } = require('./datasource');
const cuid = require('cuid');
const deepSet = require('lodash.set');

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

    this._resolvers = wrapResolvers(this, resolvers);

    this._imports = imports && imports.length > 0 ? imports.map((i) => GraphQLComponent.isComponent(i) ? { component: i, excludes: [], proxyImportedResolvers: true } : i) : [];

    this._dataSources = dataSources;

    this._directives = directives;

    this._context = createContext(this, context);

    this._dataSourceInjection = createDataSourceInjection(this, dataSourceOverrides);

<<<<<<< HEAD
    const importedTypes = [];
    const importedResolvers = [];
    const importedDirectives = [];

    for (const imp of imports) {
      if (GraphQLComponent.isComponent(imp)) {
        const component = imp;
        importedDirectives.push(getImportedDirectives(this, component));
        importedTypes.push(...getImportedTypes(this, component));
        importedResolvers.push(getImportedResolvers(component));
        this._imports.push(component);
        continue;
      }

      const { component, exclude, proxyImportedResolvers = true } = imp;

      if (!exclude || !exclude.length) {
        importedDirectives.push(getImportedDirectives(this, component));
        importedTypes.push(...getImportedTypes(this, component));
        importedResolvers.push(getImportedResolvers(component, proxyImportedResolvers));
      }
      else {
        const excludes = exclude.map((filter) => {
          return filter.split('.');
        });

        importedDirectives.push(getImportedDirectives(this, component));
        importedTypes.push(...getImportedTypes(this, component, excludes));
        importedResolvers.push(transformResolvers(getImportedResolvers(component, proxyImportedResolvers), excludes));
      }

      this._imports.push(component);
    }
=======
    this._useMocks = useMocks;
>>>>>>> refactor how types and resolvers are merged

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

    const { mergedTypes, mergedResolvers } = buildDependencyTree(this);

    const typeDefs = mergeTypeDefs([...mergedTypes, ...this._types.map((type) => graphql.parse(type))]);
    const resolvers = mergeResolvers([...mergedResolvers, this._resolvers]);
    const schemaDirectives = this._directives;

    const makeSchema = this._federation ? this.makeFederatedSchemaWithDirectives : makeExecutableSchema;

    const schema = makeSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveResolvers=${this._preserveResolvers}`);

      addMockFunctionsToSchema({ schema, mocks: this._mocks, preserveResolvers: this._preserveResolvers });
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
