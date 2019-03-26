'use strict';

const GraphQL = require('graphql');
const Gql = require('graphql-tag');
const GraphQLTools = require('graphql-tools');
const GraphQLToolkit = require('graphql-toolkit');
const Resolvers = require('./resolvers');
const Context = require('./context');
const Types = require('./types');
const Merge = require('./merge');
const Fragments = require('./fragments');

const debug = require('debug')('graphql-component:schema');

class GraphQLComponent {
  constructor({
    types = [],
    resolvers = {},
    imports = [],
    mocks = () => ({}),
    directives = {},
    context = {},
    useMocks = false,
    preserveTypeResolvers = false
  } = {}) {
    debug(`creating component`);

    this._schema = undefined;

    this._types = Array.isArray(types) ? types : [types];

    this._resolvers = Resolvers.wrapResolvers(this, resolvers);

    this._imports = [];

    this._directives = directives;

    this._context = Context.builder(this, context);

    const importedTypes = [];
    const importedResolvers = [];

    for (const imp of imports) {
      if (GraphQLComponent.isComponent(imp)) {
        importedTypes.push(...Types.getImportedTypes(imp));
        importedResolvers.push(Resolvers.getImportedResolvers(imp));
        this._imports.push(imp);
        continue;
      }

      if (!imp.exclude || !imp.exclude.length) {
        importedTypes.push(...Types.getImportedTypes(imp.component));
        importedResolvers.push(Resolvers.getImportedResolvers(imp.component));
      }
      else {
        const excludes = imp.exclude.map((filter) => {
          return filter.split('.');
        });

        importedTypes.push(...Types.getImportedTypes(imp.component, excludes));
        importedResolvers.push(Resolvers.transformResolvers(Resolvers.getImportedResolvers(imp.component), excludes));
      }

      this._imports.push(imp.component);
    }

    this._importedTypes = importedTypes;
    this._importedResolvers = GraphQLToolkit.mergeResolvers(importedResolvers);

    this._useMocks = useMocks;
    this._importedMocks = Object.assign({}, ...this._imports.map((c) => c._mocks));
    this._mocks = mocks(this._importedMocks);
    this._preserveTypeResolvers = preserveTypeResolvers;

    this._mergedTypes = GraphQLToolkit.mergeTypeDefs([...this._types, ...this._importedTypes]);
    this._mergedResolvers = Merge.mergeResolvers(this._resolvers, this._importedResolvers);

    this._fragments = Fragments.buildFragments(this._mergedTypes);
  }

  static isComponent(check) {
    return check && check._types && check._resolvers;
  }

  async execute(input, { root = undefined, context = {}, variables = {} } = {}) {
    return await GraphQL.execute({ schema: this.schema, document: Gql`${this._fragments.join('\n')}\n${input}`, rootValue: root, contextValue: context, variableValues: variables });
  }

  get schema() {
    if (this._schema) {
      return this._schema;
    }

    const typeDefs = this._mergedTypes;
    const resolvers = this._mergedResolvers;
    const schemaDirectives = this._directives;

    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);

      const mocks = Object.assign({}, this._importedMocks, this._mocks);

      GraphQLTools.addMockFunctionsToSchema({ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
    }

    this._schema = schema;

    return this._schema;
  }

  get context() {
    return Context.create(this._context.bind(this));
  }

  get types() {
    return this._types;
  }

  get resolvers() {
    return this._resolvers;
  }
}

module.exports = GraphQLComponent;
