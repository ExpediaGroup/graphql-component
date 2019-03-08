
const { Binding } = require('graphql-binding');
const GraphQLComponent = require('../../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Property = require('../property-component');
const Reviews = require('../reviews-component');

class ListingComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    super ({ 
      types: Types, 
      resolvers: Resolvers, 
      imports: [
        {
          component: new Property({ useMocks, preserveTypeResolvers }),
          exclude: ['Query.*']
        },
        {
          component: new Reviews({ useMocks, preserveTypeResolvers }),
          exclude: ['Query.*']
        }
      ] 
    });

    this.bindings = new WeakMap();
    this.imports.forEach((imp) => {
      this.bindings.set(imp.constructor, new Binding({ schema: imp.schema }))
    })
  }
}

module.exports = ListingComponent;