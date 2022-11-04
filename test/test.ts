
import { MapperKind } from '@graphql-tools/utils';
import { SchemaDirectiveVisitor } from 'apollo-server';
import { GraphQLFieldConfig, GraphQLSchema } from 'graphql';
import { test } from 'tape';
import GraphQLComponent from '../src';

test('component names', (t) => {

  t.test('generic name for anonymous constructor', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({});

    t.equals(component.name, 'GraphQLComponent', `unnamed constructor results in component named 'GraphQLComponent'`);
  });

  t.test('component name (named constructor)', (t) => {
    t.plan(1);
    
    class Named extends GraphQLComponent {}
    
    const component = new Named({});

    t.equals(component.name, 'Named', `named constructor reflects class name`);
  });

});

test('getters tests', (t) => {

  t.test('component types', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({
      types: `type Query { a: String }`,
      imports: [new GraphQLComponent({
        types: `type Query { b: B } type B { someField: String}`}
      )]
    });

    t.deepEquals(component.types, [`type Query { a: String }`], `only the component's own types are returned`);
  });

  t.test('component resolvers', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({
      resolvers: {
        Query: {
          a() { return 'hello'}
        }
      },
      imports: [new GraphQLComponent({
        resolvers: {
          Query: {
            b() {
              return 'goodbye';
            }
          }
        }
      })]
    });

    t.equals(Object.keys(component.resolvers.Query).length, 1, `only the component's own resolvers are returned`);
  });

  t.test('component imports', (t) => {
    t.plan(1);

    const childThatAlsoHasImports = new GraphQLComponent({
      types: `type Query { c: String }`,
      resolvers: { Query: { c() { return 'hello' }}},
      imports: [new GraphQLComponent({})]
    });
    const root = new GraphQLComponent({
      imports: [
        childThatAlsoHasImports
      ]
    });
    t.equals(root.imports.length, 1, `only component's own imports are returned`);
  });

  t.test('component datasources', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({
      dataSources: [new class ParentDataSource {
        name: 'ParentDataSource'
      }],
      imports: [new GraphQLComponent({
        dataSources: [new class ChildDataSource {
        name: 'ChildDataSource'
      }]
      })]
    });

    t.equals(Object.keys(component.dataSources).length, 1, `only component's own dataSources are returned`);
  });

});

test('component directives imports', (t) => {

  t.test('include all', (t) => {
    const component = new GraphQLComponent({
      types: `
        directive @parent_directive on OBJECT
      `,
      imports: [new GraphQLComponent({
        types: `
        directive @child_directive on OBJECT
        `
      })]
    });
  
    t.ok(component.schema.getDirective('parent_directive'), `child component directives exist in merged`);
    t.ok(component.schema.getDirective('child_directive'), `parent component directives exist in merged`);
  
    t.end();
  });

});

test('federation', (t) => {

  t.test('federated schema can include custom directive', (t) => {
    class CustomDirective extends SchemaDirectiveVisitor {
      // required for our dummy "custom" directive (ie. implement the SchemaDirectiveVisitor interface)
      visitFieldDefinition() {
        return;
      }
    }
  
    const component = new GraphQLComponent({
      types: `
        directive @custom on FIELD_DEFINITION
        type Query {
          property(id: ID!): Property @custom
        }
        type Property @key(fields: "id") {
          id: ID!
          geo: [String]
        }
        extend type Extended @key(fields: "id") {
          id: ID! @external
          newProp: String
        }
      `,
      resolvers: {
        Query: {
          property(_, { id }) {
            return {
              id,
              geo: ['lat', 'long']
            }
          }
        },
      },
      transforms: [{
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          return fieldConfig;
        }
      }],
      federation: true
    });
  
    t.test('federated schema created without error', (t) => {
      t.plan(1);
      t.doesNotThrow(() => {
        component.schema;
      }, 'can return a buildFederatedSchema schema');
    });
  
    t.test('custom directive added to federated schema', (t) => {
      t.plan(1);
      const { schema } = component;
      
      const schemaDirectives = schema.getDirectives();

      t.equals(schemaDirectives.filter((directive) => directive.name === 'custom').length, 1, `federated schema has '@custom' directive`);
    });
  
  });

});
