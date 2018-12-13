
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Fixtures = require('./lib/fixtures');
const Delegates = require('./lib/delegates');
const { MemoizeDirective } = require('./lib/directives');

//TODO: remote binding
//TODO: break imports into imported types and imported resolvers so that you don't create delegates for things you don't need.
class GraphQLComponent {
  constructor({ types = [], rootTypes = [], resolvers = {}, imports = [], fixtures = {} }) {

    this._types = Array.isArray(types) ? types : [types];
    this._fixtures = fixtures;
    this._resolvers = Fixtures.wrapFixtures(resolvers, this._fixtures);

    this._rootTypes = Array.isArray(rootTypes) ? rootTypes : [rootTypes];

    //Flatten imported types tree
    this._importedTypes = [].concat.apply([], imports.map(({ importedTypes, types }) => [...importedTypes, ...types]));

    //Build schema with this partial's types, rootTypes, as well as the typeDefs from the imported partials.
    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs: [...this._importedTypes, ...this._rootTypes, ...this._types],
      resolvers: this._resolvers
    });

    //Merge imported partials with this partial's schemas and resolvers
    this._schema = GraphQLTools.mergeSchemas({
      schemas: [...imports.map((i) => i.schema), schema],
      // Because an imported query will only return the unextended type, ensure we provide a direct resolver that delegates
      resolvers: Delegates.createDelegates(this._resolvers, imports),
      schemaDirectives: {
        memoize: MemoizeDirective
      }
    });

    this._bindings = new Binding({ schema: this._schema });
  }

  static mergeAll(components) {
    const schemas = [];

    for (const component of components) {
        schemas.push(component.schema);
    }

    const mergedSchema = GraphQLTools.mergeSchemas({
        schemas
    });
    
    return mergedSchema;
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

  get fixtures() {
    return this._fixtures;
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