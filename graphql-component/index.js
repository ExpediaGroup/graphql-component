
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./lib/resolvers');
const Delegates = require('./lib/delegates');
const { MemoizeDirective } = require('./lib/directives');
const Merge = require('./lib/merge');

const flatten = function (obj, mapFunc) {
  return Array.prototype.concat.apply([], obj.map(mapFunc));
};

class GraphQLComponent {
  constructor({ types = [], rootTypes = [], resolvers = {}, imports = [], fixtures = {}, directives = {} }) {

      this._types = Array.isArray(types) ? types : [types];
      this._rootTypes = Array.isArray(rootTypes) ? rootTypes : [rootTypes];
      this._resolvers = Resolvers.wrapResolvers(resolvers, fixtures);
      this._imports = imports;
      this._imported = {
        types: flatten(imports, ({ types, imported }) => [...types, ...imported.types]),
        rootTypes: flatten(imports, ({ rootTypes }) => rootTypes)
      };
      this._delegates = Delegates.createDelegates(this._imports);
      this._directives = Object.assign({ memoize: MemoizeDirective }, directives);

      const schema = GraphQLTools.makeExecutableSchema({
        typeDefs: [ ...this._imported.types, ...this._rootTypes, ...this._types],
        resolvers: this._resolvers,
        directives: this._directives
      });

      this._schema = GraphQLTools.mergeSchemas({
        schemas: [...this._imports.map(({ schema }) => schema), schema],
        resolvers: Merge.mergeResolvers(this._resolvers, this._delegates),
        directives: this._directives
      });
  
      this._bindings = new Binding({ schema });
  }

  static mergeAll(components) {
    const merged = {
      schemas: [],
      types: [],
      rootTypes: [],
      resolvers: {},
      directives: {}
    };

    for (const component of components) {
      merged.schemas.push(component.schema),
      merged.types.push(...component.types, ...component.imported.types);
      merged.rootTypes.push(...component.rootTypes, ...component.imported.rootTypes);
      merged.resolvers = Merge.mergeResolvers(merged.resolvers, component.resolvers);
      merged.directives = Object.assign(merged.directives, component.directives);
    }
    
    const schema = GraphQLTools.mergeSchemas({
      schemas: [...merged.schemas, ...merged.rootTypes, ...merged.types],
      resolvers: merged.resolvers,
      directives: merged.directives
    });

    return schema;
  }

  get types() {
    return this._types;
  }

  get rootTypes() {
    return this._rootTypes;
  }

  get imported() {
    return this._imported;
  }

  get resolvers() {
    return this._resolvers;
  }

  get delegates() {
    return this._delegates;
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