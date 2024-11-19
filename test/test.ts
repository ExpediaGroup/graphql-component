import { DirectiveLocation, MapperKind, mapSchema } from '@graphql-tools/utils';
import { RenameTypes, SchemaDirectiveVisitor } from 'apollo-server';
import { graphql, GraphQLDirective, GraphQLFieldConfig, GraphQLSchema, GraphQLString, printSchema } from 'graphql';
import { test } from 'tape';
import GraphQLComponent, { IDataSource } from '../src';

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

test('context', async (t) => {
  t.plan(3);

  const component = new GraphQLComponent({
    context: {
      namespace: 'test',
      factory: (ctx) => {
        t.equals(ctx.globalValue, 'global', 'context factory receives global context');
        return { value: 'local' }; 
      }
    }
  });

  const context = await component.context({ globalValue: 'global' });

  t.equals(context.test.value, 'local', 'context namespaced value is correct');
  t.equals(context.globalValue, 'global', 'context.globalValue is correct');

});

test('data source injection', async (t) => {
  t.plan(2);

  const dataSource = new class TestDataSource implements IDataSource {
    name = 'TestDataSource';
    value = 'original';
  };

  const component = new GraphQLComponent({
    dataSources: [
      dataSource
    ]
  });

  const context = await component.context({ globalValue: 'global' });

  t.ok(context.dataSources.TestDataSource, 'data source is correctly injected');
  t.equal(context.dataSources.TestDataSource.value, 'original', 'data source is correctly injected');
});

test('data source injection', async (t) => {
  t.plan(2);

  const dataSource = new class TestDataSource implements IDataSource {
    name = 'TestDataSource';
    value = 'original';
  };

  const dataSourceOverride = new class MockTestDataSource implements IDataSource {
    name = 'TestDataSource';
    value = 'override';
  };

  const component = new GraphQLComponent({
    dataSources: [
      dataSource
    ],
    dataSourceOverrides: [
      dataSourceOverride
    ]
  });

  const context = await component.context({ globalValue: 'global' });

  t.ok(context.dataSources.TestDataSource, 'data source is correctly injected');
  t.equal(context.dataSources.TestDataSource.value, 'override', 'data source is correctly injected');
});

test('transform with custom directive', async (t) => {
  t.plan(1);

  const types = `
    directive @customDirective(argName: String) on FIELD_DEFINITION

    type Query {
      hello: String @customDirective(argName: "example")
    }
  `;

  const resolvers = {
    Query: {
      hello: () => 'Hello world!'
    }
  };

  const customDirective = new GraphQLDirective({
    name: 'customDirective',
    locations: [DirectiveLocation.FIELD_DEFINITION],
    args: {
      argName: { type: GraphQLString }
    }
  });

  const component = new GraphQLComponent({
    types,
    resolvers,
    transforms: [
      {
        [MapperKind.FIELD]: (fieldConfig) => {
          const directives = fieldConfig.astNode?.directives || [];
          if (directives.some(directive => directive.name.value === 'customDirective')) {
            fieldConfig.description = 'This field has a custom directive';
          }
          return fieldConfig;
        }
      }
    ]
  });

  const transformedSchema = component.schema;

  const query = `
    {
      __type(name: "Query") {
        fields {
          name
          description
        }
      }
    }
  `;

  const result = await graphql(transformedSchema, query);

  t.equal(result.data?.__type?.fields.find(field => field.name === 'hello')?.description, 'This field has a custom directive', 'custom directive is correctly applied');
});

test('schema composition', async (t) => {
  t.plan(2);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Property {
            id: ID!
            name: String
          }
        `
      }),
      new GraphQLComponent({
        types: `
          type Review {
            id: ID!
            content: String
          }
        `
      })
    ]
  });

  const schema = component.schema;

  t.ok(schema.getType('Property'), 'Property type is present in the composed schema');
  t.ok(schema.getType('Review'), 'Review type is present in the composed schema');
});

test('schema pruning', async (t) => {
  t.plan(2);

  const component = new GraphQLComponent({
    types: `
      type Query {
        hello: UsedType
      }
      type UsedType {
        id: ID!
      }
      type UnusedType {
        id: ID!
      }
    `,
    resolvers: {
      Query: {
        hello: () => 'Hello world!'
      }
    },
    pruneSchema: true
  });

  const schema = component.schema;

  t.ok(schema.getType('UsedType'), 'UsedType type is present in the composed schema');
  t.ok(!schema.getType('UnusedType'), 'unused type is pruned from the schema');
});

