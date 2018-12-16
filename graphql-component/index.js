
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./lib/resolvers');
const { MemoizeDirective } = require('./lib/directives');
const Merge = require('./lib/merge');

const flatten = function (obj, mapFunc) {
  return Array.prototype.concat.apply([], obj.map(mapFunc));
};

class GraphQLComponent {
  constructor({ name, types = [], rootTypes = [], resolvers = {}, imports = [], fixtures = {}, directives = {} }) {

    this._name = name;
    this._types = Array.isArray(types) ? types : [types];
    this._rootTypes = Array.isArray(rootTypes) ? rootTypes : [rootTypes];
    this._resolvers = Resolvers.wrapResolvers(resolvers, fixtures);
    this._imports = imports;
    this._imported = {
      types: flatten(imports, ({ types, _imported }) => [...types, ..._imported.types]),
      rootTypes: flatten(imports, ({ rootTypes }) => rootTypes),
      resolvers: Resolvers.getImportedResolvers(this._imports)
    };
    
    this._directives = Object.assign({ memoize: MemoizeDirective }, directives);

    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs: [...this._imported.types, ...this._rootTypes, ...this._types],
      resolvers: this._resolvers,
      schemaDirectives: this._directives
    });

    if (this._imports.length > 0) {
      this._schema = GraphQLTools.mergeSchemas({
        schemas: [...this._imports.map(({ schema }) => schema), schema],
        resolvers: Merge.mergeResolvers(this._resolvers, this._imported.resolvers),
        schemaDirectives: this._directives
      });
    }
    else {
      this._schema = schema;
    }

    this._bindings = new Binding({ schema });
  }

  get name() {
    return this._name;
  }

  get types() {
    return [...this._imported.types, ...this._types];
  }

  get schema() {
    return this._schema;
  }

  get Query() {
    return this._bindings.query;
  }

  get Mutation() {
    return this._bindings.mutation;
  }

  get Subscription() {
    return this._bindings.subscription;
  }
}

module.exports = GraphQLComponent;