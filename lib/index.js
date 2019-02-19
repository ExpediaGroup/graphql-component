
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./resolvers');
const { MemoizeDirective } = require('./directives');
const Merge = require('./merge');
const Context = require('./context');
const debug = require('debug')('graphql-component:schema');

class GraphQLComponent {
  constructor({ 
    types = [], 
    resolvers = {}, 
    imports = [], 
    fixtures = {}, 
    directives = {}, 
    context = {}, 
    useFixtures = false 
  }) {
    debug(`creating component schema`);

    this._types = Array.isArray(types) ? types : [types];
    this._resolvers = Resolvers.wrapResolvers(resolvers, fixtures, this, useFixtures);

    this._transforms = [];
  
    this._imports = [];

    this._importedResolvers = {};

    for (const imp of imports) {
      let filteredResolvers = Resolvers.getImportedResolvers(imp);

      if (imp instanceof GraphQLComponent) {
        this._importedResolvers = filteredResolvers;
        this._imports.push(imp); 
        continue;
      }
      
      this._imports.push(imp.component);

      const excludes = (imp.exclude || []).map((filter) => {
        return filter.split('.');
      });

      debug(`excluding ${imp.exclude} from import`);

      for (const [root, name] in excludes) {
        if (root === '*') {
          filteredResolvers = {};
          break;
        }
        if (!name || name === '' || name === '*') {
          delete filteredResolvers[root];
          continue;
        }
        delete filteredResolvers[root][name];
      }

      this._importedResolvers = filteredResolvers;

      this._transforms.push(new GraphQLTools.FilterRootFields((operation, fieldName) => {
        for (const [root, name] in excludes) {
          if (root === '*') {
            return true;
          }
          return operation === root && (name === '' || name === '*' || name === fieldName);
        }
      }));
    }
    
    this._directives = Object.assign({ memoize: MemoizeDirective }, directives);

    this._bindings = new WeakMap();

    this._imports.forEach((component) => {
      this._bindings.set(component.constructor, component._binding);
    });

    this._context = Context.builder(this, context);

    if (this._imports.length > 0) {
      const importedSchemas = this._imports.map(({ schema }) => GraphQLTools.transformSchema(schema, this._transforms));
      if (this._types.length > 0) {
        //merge from self and imports
        this._schema = GraphQLTools.mergeSchemas({
          schemas: [
            ...importedSchemas, 
            GraphQLTools.mergeSchemas({
              schemas: [...importedSchemas, ...this._types],
              resolvers: this._resolvers,
              schemaDirectives: this._directives
            })
          ],
          resolvers: Merge.mergeResolvers(this._resolvers, this._importedResolvers),
          schemaDirectives: this._directives
        });
      }
      else {
        //does not have own types, merge imports only
        this._schema = GraphQLTools.mergeSchemas({
          schemas: [...importedSchemas],
          resolvers: Merge.mergeResolvers(this._resolvers, this._importedResolvers),
          schemaDirectives: this._directives
        });
      }
      debug(`built merged schema`);
    }
    else {
      this._schema = GraphQLTools.makeExecutableSchema({
        typeDefs: [...this._types],
        resolvers: this._resolvers,
        schemaDirectives: this._directives
      });
      debug(`built schema`);
    }

    this._binding = new Binding({ schema: this._schema });
    
    debug(`created bindings`);
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