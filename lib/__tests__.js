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

Test('test component execute', (t) => {

  const types = [`
    type Book {
      id: ID!
      title: String
    }
    type Query {
      book(id: ID!) : Book
    }
  `];

  const resolvers = {
    Query: {
      book(_, { id }) {
        return {
          id,
          title: 'Some Title'
        };
      }
    }
  };

  const component = new GraphQLComponent({
    types,
    resolvers
  });

  t.test('execute query', async (t) => {
    t.plan(2);

    const query = `
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.deepEqual(data, { book: { title: 'Some Title' } }, 'has result');
    t.equal(errors.length, 0, 'no errors');
  });

  t.test('execute query with document object', async (t) => {
    t.plan(1);

    const query = gql`
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { book: { title: 'Some Title' } }, 'has result');
  });

  t.test('execute error', async (t) => {
    t.plan(2);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.ok(data);
    t.ok(errors && errors.length === 1, 'error');
  });

  t.test('execute error merged', async (t) => {
    t.plan(1);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.ok(result.book instanceof Error, 'error');
  });

  t.test('execute multiple query', async (t) => {
    t.plan(1);

    const query = `
      query {
        one: book(id: 1) {
          title
        }
        two: book(id: 2) {
          id,
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { one: { title: 'Some Title' }, two: { id: '2', title: 'Some Title' } }, 'data returned');
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

  const { test } = await component.execute(`query { test { value } }`, { mergeErrors: true });

  t.equal(test.value, true, 'resolved');
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

    const query = `
      query {
        a { value }
        b { value }
        c { value }
      }
    `;

    const result = await componentC.execute(query, { mergeErrors: true });

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