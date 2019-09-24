'use strict';

const graphql = require('graphql');
const gql = require('graphql-tag');
const { makeExecutableSchema, addMockFunctionsToSchema } = require('graphql-tools');
const { mergeResolvers, mergeTypeDefs } = require('graphql-toolkit');
const { getImportedResolvers, transformResolvers, wrapResolvers } = require('./resolvers');
const { wrapContext, createContext } = require('./context');
const { getImportedTypes } = require('./types');
const { buildFragments } = require('./fragments');
const { mergeDirectives, getImportedDirectives } = require('./directives');
const { createDataSourceInjection } = require('./datasource');
const cuid = require('cuid');

const debug = require('debug')('graphql-component:schema');

class GraphQLComponent {
  constructor({
    types = [],
    resolvers = {},
    imports = [],
    dataSource = undefined,
    mocks = undefined,
    directives = undefined,
    context = undefined,
    useMocks = false,
    preserveTypeResolvers = false,
    dataSourceOverrides = []
  } = {}) {
    debug(`creating component`);

    //This is really only used for avoiding directive collisions
    this._id = cuid().slice(12);

    this._schema = undefined;

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = wrapResolvers(this, resolvers);

    this._imports = [];

    this._dataSource = dataSource;

    this._directives = directives;

    this._context = createContext(this, context);

    this._dataSourceInjection = createDataSourceInjection(this, dataSourceOverrides);

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

      const { component, exclude } = imp;

      if (!exclude || !exclude.length) {
        importedDirectives.push(getImportedDirectives(this, component));
        importedTypes.push(...getImportedTypes(this, component));
        importedResolvers.push(getImportedResolvers(component));
      }
      else {
        const excludes = exclude.map((filter) => {
          return filter.split('.');
        });

        importedDirectives.push(getImportedDirectives(this, component));
        importedTypes.push(...getImportedTypes(this, component, excludes));
        importedResolvers.push(transformResolvers(getImportedResolvers(component), excludes));
      }

      this._imports.push(component);
    }

    this._importedTypes = importedTypes;
    this._importedResolvers = mergeResolvers(importedResolvers);
    this._importedDirectives = importedDirectives;

    this._useMocks = useMocks;
    this._importedMocks = Object.assign({}, ...this._imports.map((c) => ({ ...c.mocks, ...c._importedMocks})));
    this._mocks = mocks && mocks(this._importedMocks);
    this._preserveTypeResolvers = preserveTypeResolvers;

    this._mergedTypes = mergeTypeDefs([...this._importedTypes, ...this._types]);
    this._mergedResolvers = mergeResolvers([this._importedResolvers, this._resolvers]);
    this._mergedDirectives = mergeDirectives([...this._importedDirectives, this._directives]);

    this._fragments = buildFragments(this._mergedTypes);
  }

  static isComponent(check) {
    return check && check._types && check._resolvers && check._imports;
  }

  execute(input, { root = undefined, context = {}, variables = {} } = {}) {
    return graphql.execute({ schema: this.schema, document: gql`${this._fragments.join('\n')}\n${input}`, rootValue: root, contextValue: context, variableValues: variables });
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    const typeDefs = this._mergedTypes;
    const resolvers = this._mergedResolvers;
    const schemaDirectives = this._mergedDirectives;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);

      const mocks = Object.assign({}, this._importedMocks, this._mocks);

      addMockFunctionsToSchema({ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
    }

    this._schema = schema;

    return this._schema;
  }

  get context() {
    return wrapContext(this);
  }

  get schemaDirectives() {
    return this._mergedDirectives;
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

  get dataSource() {
    return this._dataSource;
  }
}

module.exports = GraphQLComponent;
