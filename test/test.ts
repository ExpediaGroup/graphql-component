
import { SchemaDirectiveVisitor } from 'apollo-server';
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

  t.test('component directives', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({
      directives: { parentDirective: () => {}},
      imports: [new GraphQLComponent({
        directives: { childDirective: () => {}}
      })]
    });

    t.equals(Object.keys(component.directives).length, 1, `only component's own directives are returned`);
  });

  t.test('component datasources', (t) => {
    t.plan(1);

    const component = new GraphQLComponent({
      dataSources: ['parentDataSourcePlaceHolder'],
      imports: [new GraphQLComponent({
        dataSources: ['childDataSourcePlaceHolder']
      })]
    });

    t.equals(Object.keys(component.dataSources).length, 1, `only component's own dataSources are returned`);
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
      directives: { custom: CustomDirective },
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
  
    t.test('extended properties maintained after adding custom directive', (t) => {
      t.plan(2);
      const { schema } = component;
      const Extended = schema.getTypeMap().Extended;
      const astNodes = Extended.extensionASTNodes[0] as any;

      t.equals(Extended.extensionASTNodes.length, 1, 'Extension AST Nodes is defined');
      t.equals(astNodes.fields.filter((field) => field.name.value === "id" && field.directives[0].name.value === "external").length, 1, `id field marked external`);
      
    });
  });

});
