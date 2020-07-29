const Test = require('tape');
const gql = require('graphql-tag');
const graphql = require('graphql');
const GraphQLComponent = require('../');

Test('integration - automatic child root resolver proxying via delegateToComponent', async (t) => {

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

  const { data } = await graphql.execute({
    document: gql`query { test { value } }`,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(data.test.value, true, 'resolved');
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
        childById: Child
      }
    `,
    resolvers: {
      Query: {
        childById() {
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
            fieldMap: {
              child: 'childById'
            },
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
        parent: async function () {
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

  t.deepEqual(parent1, { child: { childField: 'Child Field', addedField: 'Added from Parent', }}, 'received correct first result');
  t.deepEqual(parent2, { child: { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }}, 'received correct second result');
});

Test('delegateToComponent with errors', async (t) => {

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

Test('delegateToComponent - return type is abstract', async (t) => {
  let resolveTypeCallCount = 0;
  const child = new GraphQLComponent({
    types: `
      type Query {
        things: [Thing]
      }
      interface Thing {
        id: ID
      }
      type Person implements Thing {
        id: ID
        name: String
      }
      type Animal implements Thing {
        id: ID
        someField: Int
      }
    `,
    resolvers: {
      Query: {
        things() {
          return [
            {
              id: '1',
              name: 'Joe Smith'
            }
          ]
        }
      },
      Thing: {
        __resolveType(parent) {
          resolveTypeCallCount = resolveTypeCallCount + 1;
          if (parent.name) {
            return 'Person';
          }
          return 'Animal';
        }
      }
    }
  });

  const parent = new GraphQLComponent({
    imports: [
      child
    ]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        things {
          id
          ... on Person {
            name
          }
        }
      }
    `,
    schema: parent.schema,
    contextValue: {}
  });

  t.deepEquals(result.data.things, [{ id: '1', name: 'Joe Smith', __typename: 'Person' }], 'interface type resolved');
  t.equals(resolveTypeCallCount, 1, '__resolveType called in child once per item in list');
  t.notOk(result.errors, 'no errors');
  t.end();
});