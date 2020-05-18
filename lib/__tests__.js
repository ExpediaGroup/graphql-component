'use strict';

const Test = require('tape');
const gql = require('graphql-tag');
const { SchemaDirectiveVisitor } = require('apollo-server');
const graphql = require('graphql');
const GraphQLComponent = require('./index');

Test('component API', (t) => {

  t.plan(1);

  const component = new GraphQLComponent();

  t.ok(component._id, '_id populated.');
});

Test('component isComponent', (t) => {

  t.test('isComponent not a subclass', (t) => {
    t.plan(1);

    t.ok(!GraphQLComponent.isComponent(Object.create({ types: [], resolvers: {} })), 'not a subclass');
  });

  t.test('isComponent', (t) => {
    t.plan(1);

    t.ok(GraphQLComponent.isComponent(new GraphQLComponent()), 'new super class is component');
  });

  t.test('isComponent subclass', (t) => {
    t.plan(1);

    t.ok(GraphQLComponent.isComponent(new class extends GraphQLComponent { }), 'new subclass is component');
  });

});

Test('component resolver delegate', async (t) => {

  t.plan(1);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
          }
          type Query {
            test: Test
          }
        `,
        resolvers: {
          Query: {
            test() {
              return {
                value: true
              }
            }
          }
        }
      })
    ]
  });

  const { data, errors } = await graphql.execute({
    document: gql`query { test { value } }`,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(data.test.value, true, 'resolved');
});

Test('component resolver delegate errors', async (t) => {

  t.plan(3);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
            err: Boolean
          }
          type Query {
            test: Test
          }
        `,
        resolvers: {
          Query: {
            test() {
              return {
                value: true,
                err: true
              }
            }
          },
          Test: {
            err(_) {
              if (_.err) {
                throw new Error('error');
              }
            }
          }
        }
      })
    ]
  });

  const document = gql`
    query { 
      foo: test { value, err } 
      bar: test { value }
    }`;

  const { data, errors } = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.equal(data.foo.value, true, 'resolved alias 1');
  t.equal(data.bar.value, true, 'resolved alias 2');
  t.ok(errors && errors.length > 0, 'got error');
});

Test('delegateToComponent from root type', async (t) => {

  t.plan(3);

  const childComponent = new GraphQLComponent({
    types: `
      type Child {
        childField: String
        anotherChildField: String
      }
      type Query {
        child: Child
      }
    `,
    resolvers: {
      Query: {
        child() {
          return {
            childField: 'Child Field',
            anotherChildField: 'Another Child Field'
          }
        }
      }
    }
  });

  const component = new GraphQLComponent({
    types: `
      type Parent {
        child: Child
      }
      type Child {
        addedField: String
      }
      type Query {
        parent: Parent
      }
    `,
    resolvers: {
      Query: {
        parent: async function (_, args, context, info) {
          const child = await GraphQLComponent.delegateToComponent(childComponent, {
            subPath: 'child',
            contextValue: context,
            info
          });

          return {
            child
          };
        }
      },
      Child: {
        addedField() {
          return 'Added from Parent'
        }
      }
    },
    imports: [
      childComponent
    ]
  });

  const document = gql`
    query { 
      parent1: parent {
        child {
          childField
          addedField
        }
      }
      parent2: parent {
        child {
          anotherChildField
          addedField
        }
      }
    }`;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { parent1, parent2 } = result.data;

  t.deepEqual(parent1, { child: { childField: 'Child Field', addedField: 'Added from Parent' }}, 'received correct first result');
  t.deepEqual(parent2, { child: { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }}, 'received correct second result');
});

Test('delegateToComponent from type resolver', async (t) => {

  t.plan(3);

  const childComponent = new GraphQLComponent({
    types: `
      type Child {
        childField: String
        anotherChildField: String
      }
      type Query {
        child: Child
      }
    `,
    resolvers: {
      Query: {
        child() {
          return {
            childField: 'Child Field',
            anotherChildField: 'Another Child Field'
          }
        }
      }
    }
  });

  const component = new GraphQLComponent({
    types: `
      type Parent {
        child: Child
      }
      type Child {
        addedField: String
      }
      type Query {
        parent: Parent
      }
    `,
    resolvers: {
      Query: {
        parent: async function (_, args, context, info) {
          return {};
        }
      },
      Parent: {
        child(_, args, context, info) {
          return GraphQLComponent.delegateToComponent(childComponent, {
            contextValue: context,
            info
          });
        }
      },
      Child: {
        addedField() {
          return 'Added from Parent'
        }
      }
    },
    imports: [
      childComponent
    ]
  });

  const document = gql`
    query { 
      parent1: parent {
        child {
          childField
          addedField
        }
      }
      parent2: parent {
        child {
          anotherChildField
          addedField
        }
      }
    }`;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { parent1, parent2 } = result.data;

  t.deepEqual(parent1, { child: { childField: 'Child Field', addedField: 'Added from Parent' }}, 'received correct first result');
  t.deepEqual(parent2, { child: { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }}, 'received correct second result');
});

Test.skip('FIXME test component mocks', (t) => {
  t.test('imported mocks', async (t) => {
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
      mocks: () => ({
        A: () => ({ value: 'a' })
      })
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
      mocks: () => ({
        B: () => ({ value: 'b' })
      })
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
      mocks: () => ({
        C: () => ({ value: 'c' })
      }),
      useMocks: true
    });

    const document = gql`
      query {
        a { value }
        b { value }
        c { value }
      }
    `;

    const { data, errors } = await graphql.execute({
      document,
      schema: component.schema,
      rootValue: undefined,
      contextValue: {}
    });

    t.equal(result.a.value, 'a', 'returns Component A\'s mock');
    t.equal(result.b.value, 'b', 'returns Component B\'s mock');
    t.equal(result.c.value, 'c', 'returns Component C\'s mock');
  });
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
        property(_, { id }, context, info) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      },
      Property: {
        __resolveReference(property, context) {

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
    };

    const { context } = new GraphQLComponent({
      dataSources: [new DataSource()]
    });

    const globalContext = await context({ data: 'test' });

    t.ok(globalContext.dataSources && globalContext.dataSources.TestDataSource, 'dataSource added to context');
    
    globalContext.dataSources.TestDataSource.test('test');
  });
  
});