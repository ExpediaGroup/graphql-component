'use strict';

const Test = require('tape');
const { buildDependencyTree } = require('./index');

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

  const { mergedTypes, mergedResolvers } = buildDependencyTree(tree);

  t.equal(mergedTypes.length, 2, '2 imported types');
  t.equal(mergedResolvers.length, 2, '2 imported resolvers');

  t.equal(mergedTypes[0].definitions[0].name.value, 'B', 'B type ordered properly');
  t.equal(mergedTypes[1].definitions[0].name.value, 'A', 'A type ordered properly');

  t.ok(mergedResolvers[0].Query.b, 'B resolvers ordered properly');
  t.ok(mergedResolvers[1].Query.a, 'A resolvers ordered properly');
});