'use strict';

const Test = require('tape');
const GraphQLComponent = require('../index');
const { buildDependencyTree, filterTypes } = require('./index');
const { buildASTSchema, execute } = require('graphql');
const gql = require('graphql-tag');
const { SchemaDirectiveVisitor } = require('graphql-tools');

Test('buildDependencyTree - ordering', (t) => {
  const tree = new GraphQLComponent({
    types: `
      type A {
        val: String
      }

      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a() {}
      }
    },
    imports: [
      new GraphQLComponent({
        types: `
          type B {
            val: String
          }

          type Query {
            a: A
          }
        `,
        resolvers: {
          Query: {
            b(){}
          }
        },
        imports: [new GraphQLComponent({
          types: `
            type C {
              val: String
            }

            type Query {
              c: C
            }
          `,
          resolvers: {
            Query: {
              c(){}
            }
          }
        })]
      })
    ]
  });

  const { importedTypes, importedResolvers } = buildDependencyTree(tree);
 
  t.equal(importedTypes.length, 3, '3 imported types');
  t.equal(importedResolvers.length, 3, '3 imported resolvers');

  t.equal(importedTypes[0].definitions[0].name.value, 'C', 'C type ordered properly');
  t.equal(importedTypes[1].definitions[0].name.value, 'B', 'B type ordered properly');
  t.equal(importedTypes[2].definitions[0].name.value, 'A', 'A type ordered properly');

  t.ok(importedResolvers[0].Query.c, 'c resolvers ordered properly');
  t.ok(importedResolvers[1].Query.b, 'b resolvers ordered properly');
  t.ok(importedResolvers[2].Query.a, 'a resolvers ordered properly');
  t.end();
});

Test('buildDependencyTree - set exclude option for imports', (t) => {
  const tree = new GraphQLComponent({
          imports: [{
            component: new GraphQLComponent({
              types: `
                type Query {
                  a: A
                }
      
                type A {
                  value: String
                }
              `,
              resolvers: {
                Query: {
                  a(){}
                }
              },
              imports: [{
                component: new GraphQLComponent({
                  types: `
                    type Query {
                      a: B
                    }
          
                    type B {
                      value: String
                    }
                  `,
                  resolvers: {
                    Query: {
                      b(){}
                    }
                  },
                }),
              }],
            }),
            exclude: ['Query.b']
          }]
    });

  const { importedResolvers } = buildDependencyTree(tree);
  t.ok(importedResolvers.length === 1, 'importedResolvers has 1 query');
  t.looseEqual(Object.keys(importedResolvers[0].Query), ['a'], 'importedResolvers excludes Query.b');

  t.end();
});

Test('buildDependencyTree - directive not implemented', (t) => {
  const root = new GraphQLComponent({
    types: `
      directive @foo on FIELD_DEFINITION

      type Query {
        a: A @foo
      }

      type A {
        value: String
      }
    `,
    resolvers: {
      Query: {
        a(){}
      }
    }
  });

  try {
    buildDependencyTree(root);
  } catch (e) {
    t.equals(e.message, 'GraphQLComponent defined directive: @foo but did not provide an implementation', 'error thrown with expected error message');
  }
  t.end();
});

Test('buildDependencyTree - components with directive collisions', (t) => {
  const imp = new GraphQLComponent({
    types: `
      directive @duplicate on FIELD_DEFINITION

      type Bar {
        value: String
      }

      type Query {
        bar: Bar @duplicate
      }
    `,
    Query: {
      bar(){}
    },
    directives: {
      duplicate: class extends SchemaDirectiveVisitor {
        visitFieldDefinition() {}
      }
    }
  });

  const root = new GraphQLComponent({
    types: `
      directive @duplicate on FIELD_DEFINITION
      directive @foo on FIELD_DEFINITION

      type Foo {
        value: String
      }

      type Query {
        foo: Foo @duplicate @foo
      }
    `,
    resolvers: {
      Query: {
        foo() {}
      }
    },
    imports: [imp],
    directives: {
      duplicate: class extends SchemaDirectiveVisitor {
        visitFieldDefinition(){}
      },
      foo: class extends SchemaDirectiveVisitor {
        visitFieldDefinition(){}
      }
    }
  });

  const { importedDirectives } = buildDependencyTree(root);
  t.ok(importedDirectives['duplicate'], `root's original duplicate directive imported intact`);
  t.ok(importedDirectives[`duplicate_${imp.id}`], `imp's conflicting directive is namespaced`);
  t.ok(importedDirectives['foo'], `root's non-conflicting diretive imported intact`);
  t.end();
});

Test('integration - directive collisions', (t) => {
  let impDuplicateExecuted = 0;
  let rootDuplicateExecuted = 0;
  let rootFooExecuted = 0;
  const imp = new GraphQLComponent({
    types: `
      directive @duplicate on FIELD_DEFINITION

      type Bar {
        value: String
      }

      type Query {
        bar: Bar @duplicate
      }
    `,
    Query: {
      bar(){}
    },
    directives: {
      duplicate: class extends SchemaDirectiveVisitor {
        visitFieldDefinition() {
          impDuplicateExecuted += 1;
        }
      }
    }
  });

  const root = new GraphQLComponent({
    types: `
      directive @duplicate on FIELD_DEFINITION
      directive @foo on FIELD_DEFINITION

      type Foo {
        value: String
      }

      type Query {
        foo: Foo @duplicate @foo
      }
    `,
    resolvers: {
      Query: {
        foo() {}
      }
    },
    imports: [imp],
    directives: {
      duplicate: class extends SchemaDirectiveVisitor {
        visitFieldDefinition(){
          rootDuplicateExecuted += 1;
        }
      },
      foo: class extends SchemaDirectiveVisitor {
        visitFieldDefinition(){
          rootFooExecuted += 1;
        }
      }
    }
  });

  const document = gql`
    query {
      foo {
        value
      }
      bar {
        value
      }
    }
  `;

  // execute the above queries to see that the directives executed
  execute({
    document,
    schema: root.schema,
    contextValue: {}
  });

  t.equal(rootDuplicateExecuted, 1, 'root @duplicate directive executed one time as expected');
  t.equal(rootFooExecuted, 1, 'root @duplicate directive executed one time as expected')
  t.equal(impDuplicateExecuted, 1, 'imp @duplicate directive executed one time as expected');
  t.end();
});

Test('filterTypes - simple exclusion', (t) => {
  const types = gql`
    type B {
      value: String
    }

    type A {
      value: String
    }

    type Query {
      a: A
      b: B
    }
  `;

  const filteredTypes = filterTypes([types], [['Query', 'b']]);
  const schema = buildASTSchema(filteredTypes[0]);
  t.ok(schema.getType('A'), 'type A exists');
  t.ok(schema.getType('B'), 'type B exists');
  t.ok(schema.getType('Query').getFields().a, 'Query.a exists');
  t.notOk(schema.getType('Query').getFields().b, 'Query.b has been excluded');
  t.end();
});

Test('filterTypes - asterisk exclusion', (t) => {
  const types = gql`
    type B {
      value: String
    }

    type A {
      value: String
    }

    type Query {
      a: A
      b: B
    }
  `;

  const filteredTypes = filterTypes([types], [['Query', '*']]);
  const schema = buildASTSchema(filteredTypes[0]);
  t.ok(schema.getType('A'), 'type A exists');
  t.ok(schema.getType('B'), 'type B exists');
  t.notOk(schema.getType('Query'), 'Query type has been completed excluded');
  t.end();
});

Test('filterTypes - one by one exclusion', (t) => {
  const types = gql`
    type B {
      value: String
    }

    type A {
      value: String
    }

    type Query {
      a: A
      b: B
    }
  `;

  const filteredTypes = filterTypes([types], [['Query', 'a'], ['Query', 'b']]);
  const schema = buildASTSchema(filteredTypes[0]);
  t.ok(schema.getType('A'), 'type A exists');
  t.ok(schema.getType('B'), 'type B exists');
  t.notOk(schema.getType('Query'), 'Query type has been completed excluded');
  t.end();
})