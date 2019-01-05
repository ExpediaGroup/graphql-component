
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./resolvers');
const { MemoizeDirective } = require('./directives');
const Merge = require('./merge');
const Context = require('./context');
const debug = require('debug')('graphql-component:schema');

const flatten = function (obj, mapFunc) {
  return Array.prototype.concat.apply([], obj.map(mapFunc));
};

class GraphQLComponent {
  constructor({ types = [], rootTypes = [], resolvers = {}, imports = [], fixtures = {}, directives = {}, context = {}, useFixtures = false }) {
    debug(`creating component schema`);

    this._types = Array.isArray(types) ? types : [types];
    this._rootTypes = Array.isArray(rootTypes) ? rootTypes : [rootTypes];
    this._resolvers = Resolvers.wrapResolvers(resolvers, fixtures, this, useFixtures);
    this._imports = imports;
    this._imported = {
      types: flatten(imports, ({ _types, _imported }) => [..._types, ..._imported.types]),
      resolvers: Resolvers.getImportedResolvers(this._imports)
    };
    
    this._directives = Object.assign({ memoize: MemoizeDirective }, directives);

    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs: [...this._imported.types, ...this._rootTypes, ...this._types],
      resolvers: this._resolvers,
      schemaDirectives: this._directives
    });

    debug(`built schema`);

    if (this._imports.length > 0) {
      this._schema = GraphQLTools.mergeSchemas({
        schemas: [...this._imports.map(({ schema }) => schema), schema],
        resolvers: Merge.mergeResolvers(this._resolvers, this._imported.resolvers),
        schemaDirectives: this._directives
      });
      
      debug(`merged schema`);
    }
    else {
      this._schema = schema;
    }

    this._bindings = new WeakMap();

    imports.forEach((component) => {
      this._bindings.set(component.constructor, component._binding);
    });

    this._binding = new Binding({ schema });
    
    debug(`created bindings`);

    this._context = Context.builder(this, context);
  }

  get context() {
    return async (request) => {
      const context = await this._context(request);

      return { 
        request, 
        ...context
      };
    };
  }

  get resolvers() {
    return this._resolvers;
  }

  get schema() {
    return this._schema;
  }

  get bindings() {
    return {
      get: (key) => {
        return this._bindings.get(key);
      }
    };
  }
}

module.exports = GraphQLComponent;