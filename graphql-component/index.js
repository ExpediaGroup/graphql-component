
const { Binding } = require('graphql-binding');
const { makeExecutableSchema, mergeSchemas } = require('graphql-tools');
const { wrapResolvers } = require('./lib/wrap_resolvers');

//TODO: remote binding
class GraphQLComponent {
  constructor({ types = [], rootTypes = [], resolvers = {}, imports = [], fixtures = {} }) {

    this._types = Array.isArray(types) ? types : [types];
    this._fixtures = fixtures;
    this._resolvers = wrapResolvers(resolvers, this._fixtures);

    this._rootTypes = Array.isArray(rootTypes) ? rootTypes : [rootTypes];

    //Flatten imported types tree
    this._importedTypes = [].concat.apply([], imports.map(({ importedTypes, types }) => [...importedTypes, ...types]));

    //Build schema with this partial's types, rootTypes, as well as the typeDefs from the imported partials.
    const schema = makeExecutableSchema({
      typeDefs: [...this._importedTypes, ...this._rootTypes, ...this._types],
      resolvers: this._resolvers
    });

    //Merge imported partials with this partial's schemas and resolvers
    this._schema = mergeSchemas({
      schemas: [...imports.map((i) => i.schema), schema],
      resolvers: this._resolvers
    });

    this._bindings = new Binding({ schema: this._schema });
  }

  get types() {
    return this._types;
  }

  get rootTypes() {
    return this._rootTypes;
  }

  get importedTypes() {
    return this._importedTypes;
  }

  get resolvers() {
    return this._resolvers;
  }

  get schema() {
    return this._schema;
  }

  get bindings() {
    return this._bindings;
  }

  get fixtures() {
    return this._fixtures;
  }
}

module.exports = GraphQLComponent;