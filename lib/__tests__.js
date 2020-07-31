'use strict';

const Test = require('tape');
const gql = require('graphql-tag');
const { SchemaDirectiveVisitor } = require('@graphql-tools/utils');
const graphql = require('graphql');
const GraphQLComponent = require('./index');

Test('component API', (t) => {

  t.test('component name (anonymous constructor)', (st) => {
    const component = new GraphQLComponent();
    t.equals(component.name, 'GraphQLComponent', `unnamed constructor results in component named 'GraphQLComponent'`);
    st.end();
  })

  t.test('component name (named constructor)', (st) => {
    class Named extends GraphQLComponent {}
    const component = new Named();
    t.equals(component.name, 'Named', `named constructor results in 'Named'`);
    st.end();
  });

  t.test('component id', (st) => {
    const component = new GraphQLComponent();
    t.ok(component.id, `got component's id`);
    st.end();
  });

  t.test('isComponent with config object', (st) => {
    st.notOk(GraphQLComponent.isComponent(Object.create({ component: new GraphQLComponent, exclude: ['Query.a'] })), 'is not a component');
    st.end();
  });

  t.test('isComponent with new base class instance', (st) => {
    st.ok(GraphQLComponent.isComponent(new GraphQLComponent()), 'is a component');
    st.end();
  });

  t.test('isComponent with new subclass', (st) => {
    t.ok(GraphQLComponent.isComponent(new class extends GraphQLComponent { }), 'is a component');
    st.end();
  });

  t.test('component context', (st) => {
    const component = new GraphQLComponent();
    const context = component.context;
    st.ok(typeof context === 'function', 'context is a function');
    st.ok(typeof context.use === 'function', 'context has a use funtion');
    st.end();
  });

  t.test('component types', (st) => {
    const component = new GraphQLComponent({
      types: `type Query { a: String }`,
      imports: [new GraphQLComponent({
        types: `type Query { b: B} type B { someField: String}`}
      )]
    });

    st.deepEquals(component.types, [`type Query { a: String }`], `only the component's own types are returned (no imports)`);
    st.end();
  });

  t.test('component resolvers', (st) => {
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

    st.equals(Object.keys(component.resolvers.Query).length, 1, `only the component's own resolvers are returned`);
    st.end();
  });

  t.test('component imports', (st) => {
    const childThatAlsoHasImports = new GraphQLComponent({
      types: `type Query { c: String }`,
      resolvers: { Query: { c() { return 'hello' }}},
      imports: [new GraphQLComponent()]
    });
    const root = new GraphQLComponent({
      imports: [
        childThatAlsoHasImports
      ]
    });
    st.equals(root.imports.length, 1, `only component's own imports are returned`);
    st.equals(childThatAlsoHasImports.id, root.imports[0].component.id, `id of only import matches import instance's id`);
    st.end();
  });

  t.test('component mocks', (st) => {
    const component = new GraphQLComponent({
      mocks: { Query: { mockA() { return 'mockAString' }}},
      imports: [new GraphQLComponent({
        mocks: { Query: { mockB() { return 'mockBString' }}}
      })]
    });

    st.equals(Object.keys(component.mocks).length, 1, `only component's own mocks are returned`);
    st.end();
  });

  t.test('component directives', (st) => {
    const component = new GraphQLComponent({
      directives: { parentDirective: () => {}},
      imports: [new GraphQLComponent({
        directives: { childDirective: () => {}}
      })]
    });

    st.equals(Object.keys(component.directives).length, 1, `only component's own directives are returned`);
    st.end();
  });

  t.test('component datasources', (st) => {
    const component = new GraphQLComponent({
      dataSources: ['parentDataSourcePlaceHolder'],
      imports: [new GraphQLComponent({
        dataSources: ['childDataSourcePlaceHolder']
      })]
    });

    st.equals(Object.keys(component.dataSources).length, 1, `only component's own dataSources are returned`);
    st.end();
  });
});

Test('mocks', async (t) => {
    t.plan(3);

    const componentA = new GraphQLComponent({
      types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `],
      mocks: {
        A: () => ({ value: 'a' })
      }
    });

    const componentB = new GraphQLComponent({
      types: [`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      imports: [
        componentA
      ],
      mocks: {
        B: () => ({ value: 'b' })
      }
    });

    const componentC = new GraphQLComponent({
      types: [`
        type C {
          value: String
        }
        type Query {
          c: C
        }
      `],
      imports: [
        componentB
      ],
      mocks: {
        C: () => ({ value: 'c' })
      },
      useMocks: true
    });

    const document = gql`
      query {
        a { value }
        b { value }
        c { value }
      }
    `;

    const { data } = await graphql.execute({
      document,
      schema: componentC.schema,
      rootValue: undefined,
      contextValue: {}
    });

    t.equal(data.a.value, 'a', 'returns Component A\'s mock');
    t.equal(data.b.value, 'b', 'returns Component B\'s mock');
    t.equal(data.c.value, 'c', 'returns Component C\'s mock');
});

Test('federated schema', (t) => {

  class CustomDirective extends SchemaDirectiveVisitor {
    // required for our dummy "custom" directive (ie. implement the SchemaDirectiveVisitor interface)
    visitFieldDefinition() {
      return;
    }
  }

  const component = new GraphQLComponent({
    types: [
      `
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
      `
    ],
    resolvers: {
      Query: {
        property(_, { id }) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      },
      Property: {
        __resolveReference() {

        }
      }
    },
    directives: { custom: CustomDirective },
    federation: true
  });

  t.test('create federated schema', (t) => {
    t.plan(1);
    t.doesNotThrow(() => {
      component.schema;
    }, 'can return a buildFederatedSchema schema');
  });

  t.test('custom directive added to federated schema', (t) => {
    t.plan(1);
    const { schema: { _directives: schemaDirectives } } = component;
    t.equals(schemaDirectives.filter((directive) => directive.name === 'custom').length, 1, `federated schema has '@custom' directive`);
  });

  t.test('extended properties maintained after adding custom directive', (t) => {
    t.plan(2);
    const { schema: { _typeMap: { Extended } } } = component;
    t.equals(Extended.extensionASTNodes.length, 1, 'Extension AST Nodes is defined');
    t.equals(Extended.extensionASTNodes[0].fields.filter((field) => field.name.value === "id" && field.directives[0].name.value === "external").length, 1, `id field marked external`);
  });
});

Test('integration: data source', (t) => {

  t.test('component and context injection', async (t) => {
    t.plan(4);

    class DataSource {
      static get name() {
        return 'TestDataSource';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    }

    const { context } = new GraphQLComponent({
      dataSources: [new DataSource()]
    });

    const globalContext = await context({ data: 'test' });

    t.ok(globalContext.dataSources && globalContext.dataSources.TestDataSource, 'dataSource added to context');
    
    globalContext.dataSources.TestDataSource.test('test');
  });
  
});

