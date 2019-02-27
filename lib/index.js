'use strict';

const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./resolvers');
const { MemoizeDirective } = require('./directives');
const Context = require('./context');
const debug = require('debug')('graphql-component:schema');

class GraphQLComponent {
  constructor({ 
    types = [], 
    resolvers = {}, 
    imports = [], 
    mocks = {}, 
    directives = {}, 
    context = {}, 
    useMocks = false,
    preserveTypeResolvers = false
  }) {
    debug(`creating component schema`);

    this._types = Array.isArray(types) ? types : [types];
    this._resolvers = Resolvers.wrapResolvers(this, resolvers);
  
    this._imports = [];

    this._importedResolvers = {};
    
    this._directives = Object.assign({}, directives, { memoize: MemoizeDirective });

    this._bindings = new WeakMap();

    this._transforms = new WeakMap();

    this._context = Context.builder(this, context);

    for (const imp of imports) {
      if (imp instanceof GraphQLComponent) {
        this._importedResolvers = Resolvers.getImportedResolvers(imp);
        this._imports.push(imp); 
        this._bindings.set(imp.constructor, imp._binding);
        continue;
      }

      let filteredResolvers = Resolvers.getImportedResolvers(imp.component);

      if (!imp.exclude || !imp.exclude.length) {
        continue;
      }

      const excludes = imp.exclude.map((filter) => {
        return filter.split('.');
      });

      debug(`excluding ${imp.exclude} from import`);

      for (const [root, name] of excludes) {
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

      const transform = [
        new GraphQLTools.FilterRootFields((operation, fieldName) => {
          for (const [root, name] in excludes) {
            if (root === '*') {
              return true;
            }
            return operation === root && (name === '' || name === '*' || name === fieldName);
          }
        })
      ];

      this._transforms.set(imp.component, transform);

      this._imports.push(imp.component);

      this._bindings.set(imp.component.constructor, imp.component._binding);
    }

    if (this._imports.length > 0) {
      //Transform to strip excludes as necessary
      const importedSchemas = this._imports.map((component) => {
        const transforms = this._transforms.get(component);

        if (!transforms) {
          return component.schema;
        }

        return GraphQLTools.transformSchema(component.schema, transforms);
      });
      
      //merge from self and imports
      this._schema = GraphQLTools.mergeSchemas({
        schemas: [
          ...importedSchemas, ...this._types
        ],
        resolvers: this._resolvers,
        schemaDirectives: this._directives //Does nothing for now
      });
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

    if (useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${preserveTypeResolvers}`);
      GraphQLTools.addMockFunctionsToSchema({ schema: this._schema, mocks, preserveTypeResolvers });
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