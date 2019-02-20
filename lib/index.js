
const { Binding } = require('graphql-binding');
const GraphQLTools = require('graphql-tools');
const Resolvers = require('./resolvers');
const { MemoizeDirective } = require('./directives');
const Merge = require('./merge');
const Context = require('./context');
const debug = require('debug')('graphql-component:schema');

const flatten = (arr) => arr.reduce((acc, current) => acc.concat(Array.isArray(current) ? flatten(current) : current), []);

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

    this._transforms = [];
  
    this._imports = [];

    this._importedResolvers = {};

    for (const imp of imports) {
      if (imp instanceof GraphQLComponent) {
        this._importedResolvers = Resolvers.getImportedResolvers(imp);
        this._imports.push(imp); 
        continue;
      }

      let filteredResolvers = Resolvers.getImportedResolvers(imp.component);
      
      this._imports.push(imp.component);

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