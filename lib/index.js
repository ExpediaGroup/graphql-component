'use strict';

const GraphQLTools = require('graphql-tools');
const GraphQLToolkit = require('graphql-toolkit');
const Resolvers = require('./resolvers');
//const { MemoizeDirective } = require('./memoize');
const Context = require('./context');
const Types = require('./types');
const Merge = require('./merge');
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
  } = {}) {
    debug(`creating component`);

    this._types = Array.isArray(types) ? types : [types];
    
    this._resolvers = Resolvers.wrapResolvers(this, resolvers);
  
    this._imports = [];
    
    this._directives = Object.assign({}, directives/*not doing this as a directive right now, { memoize: MemoizeDirective }*/);

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
    this._mocks = mocks;
    this._preserveTypeResolvers = preserveTypeResolvers;
  }

  static isComponent(check) {
    return check && check._types && check._resolvers;
  }

  get schema() {
    const typeDefs = GraphQLToolkit.mergeTypeDefs([...this._importedTypes, ...this._types]);
    const resolvers = Merge.mergeResolvers(this._resolvers, this._importedResolvers);
    const schemaDirectives = this._directives;

    const schema = GraphQLTools.makeExecutableSchema({
      typeDefs,
      resolvers,
      schemaDirectives
    });

    debug(`created ${this.constructor.name} schema`);

    if (this._useMocks) {
      debug(`adding mocks, preserveTypeResolvers=${this._preserveTypeResolvers}`);
      
      const importedMocks = this._imports.map((c) => c._mocks);
      const mocks = Object.assign({}, this._mocks, ...importedMocks);

      GraphQLTools.addMockFunctionsToSchema({ schema, mocks, preserveTypeResolvers: this._preserveTypeResolvers });
    }

    return schema;
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