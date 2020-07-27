'use strict';

const Test = require('tape');
// TODO: test namespaceDirectives
const { buildDependencyTree, filterTypes, /*namespaceDirectives*/ } = require('./index');
const { buildASTSchema } = require('graphql');
const Gql = require('graphql-tag')

Test('buildDependencyTree', (t) => {
  t.plan(6);

  const tree = {
    id: 3,
    types: [
      `
      type C { 
        val: String
      }
      type Query { 
        c: C 
      }
      `
    ],
    resolvers: {
      Query: { c() {} }
    },
    imports: [
      {
        component: {
          id: 2,
          types: [
            `
            type B { 
              val: String
            }
            type Query { 
              b: B
            }
            `
          ],
          resolvers: {
            Query: { b() {} }
          },
          imports: [
            {
              component: {
                id: 1,
                types: [
                  `
                  type A { 
                    val: String
                  }
                  type Query { 
                    a: A 
                  }
                  `
                ],
                resolvers: {
                  Query: { a() {} }
                },
                imports: []
              }
            }
          ]
        }
      }
    ]
  };

  const { importedTypes, importedResolvers } = buildDependencyTree(tree);

  t.equal(importedTypes.length, 2, '2 imported types');
  t.equal(importedResolvers.length, 2, '2 imported resolvers');

  t.equal(importedTypes[0].definitions[0].name.value, 'B', 'B type ordered properly');
  t.equal(importedTypes[1].definitions[0].name.value, 'A', 'A type ordered properly');

  t.ok(importedResolvers[0].Query.b, 'B resolvers ordered properly');
  t.ok(importedResolvers[1].Query.a, 'A resolvers ordered properly');
});

Test('type utilities', (t) => {

  t.test('exclude', (t) => {

    t.plan(4);

    const component = {
      _importedTypes: [Gql`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      _types: [Gql`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    const types = filterTypes([...component._types, ...component._importedTypes], [['Query', 'b']]);
    
    const schemaA = buildASTSchema(types[0]);

    t.ok(schemaA.getType('A').getFields().value, `the "A" type exists in component's schema`);
    t.ok(schemaA.getQueryType().getFields().a, `the "a" query exists in component's schema`);

    const schemaB = buildASTSchema(types[1])
    
    t.ok(schemaB.getType('B').getFields().value, `the "B" type exists in imported component's schema`);
    t.notOk(schemaB.getQueryType(), `the "Query" type does not exist in imported component's schema because all of its fields have been removed`);
  });

  t.test('exclude all', (t) => {

    t.plan(3);

    const component = {
      _importedTypes: [],
      _types: [Gql`
        type A {
          value: String
        }
        type Query {
          a: A
        }
        type Mutation {
          a: A
        }
      `]
    };

    const types = filterTypes(component._types, [['*']]);
    const schema = buildASTSchema(types[0]);
    t.notOk(schema.getQueryType(), `the "Query" type does not exist in component's schema because all of it's fields were removed`);
    t.notOk(schema.getMutationType(), `the "Mutation" type does not exist in component's schema because all of its fields were removed`);
    t.ok(schema.getType('A').getFields().value, `the "A" type and its field exist in component's schema`);
  });
  
  t.test('component with no Mutation and 1 Query with imported component with 2 Mutations and 1 Query, exclude 1 Mutation and 1 Query from imported component', (t) => {
    t.plan(6);

    const component = {
      _importedTypes: [Gql`
        type B {
          value: String
        }
        type Query {
          b: B
        }
        type Mutation {
          b1: String
          b2: String
        }
      `],
      _types: [Gql`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    const types = filterTypes([...component._types, ...component._importedTypes], [['Mutation', 'b1'], ['Query', 'b']]);
    const schemaA = buildASTSchema(types[0]);
    t.ok(schemaA.getType('A').getFields().value, `the "A" type exists in component's schema`);
    t.ok(schemaA.getQueryType().getFields().a, `the "a" query exists in component's schema`);

    const schemaB = buildASTSchema(types[1])
    t.ok(schemaB.getType('B').getFields().value, `the "B" type exists in imported component's schema`);
    t.notOk(schemaB.getQueryType(), `the "Query" type does not exist in imported component's schema because all of its fields were removed`);
    t.notOk(schemaB.getMutationType().getFields().b1, `the "b1" mutation does not exist in imported component's schema`);
    t.ok(schemaB.getMutationType().getFields().b2, `the "b2" mutation exists in imported component's schema`);
  });
});