
const GraphQLComponent = require('../../../../lib/index');
const Resolvers = require('./resolvers');
const Types = require('./types');
const Property = require('../property-component');
const Reviews = require('../reviews-component');
const { Binding } = require('graphql-binding');

class ListingComponent extends GraphQLComponent {
  constructor({ useMocks, preserveTypeResolvers }) {
    const propertyComponent = new Property({ useMocks, preserveTypeResolvers });
    const reviewsComponent = new Reviews({ useMocks, preserveTypeResolvers });

    super ({ 
      types: Types, 
      resolvers: Resolvers, 
      imports: [
        {
          component: propertyComponent,
          exclude: ['Query.*']
        },
        {
          component: reviewsComponent,
          exclude: ['Query.*']
        }
      ] 
    });

    this.bindings = new WeakMap();
    this.bindings.set(Property, new Binding({ schema: propertyComponent.schema }));
    this.bindings.set(Reviews, new Binding({ schema: reviewsComponent.schema }));
  }
}

module.exports = ListingComponent;