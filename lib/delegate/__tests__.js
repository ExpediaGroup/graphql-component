const Test = require('tape');
const gql = require('graphql-tag');
const graphql = require('graphql');
const GraphQLComponent = require('../');

Test('integration - automatic proxy to child root resolver from parent via delegateToComponent', async (t) => {

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

Test('delegateToComponent from root type resolver to child with same name and no subpath', async (t) => {
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
      type Child {
        addedField: String
      }
      type Query {
        child: Child
      }
    `,
    resolvers: {
      Query: {
        child: async function (_, _args, context, info) {
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
      parent1: child {
        childField
        addedField
      }
        
      parent2: child {
        anotherChildField
        addedField
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { parent1, parent2 } = result.data;

  t.deepEqual(parent1, { childField: 'Child Field', addedField: 'Added from Parent' }, 'received correct first result');
  t.deepEqual(parent2, { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }, 'received correct second result');
  t.end();
});

Test('delegateToComponent from root type resolver to child with different name and no subpath', async (t) => {
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
      type Child {
        addedField: String
      }
      type Query {
        parent: Child
      }
    `,
    resolvers: {
      Query: {
        parent: async function (_, _args, context, info) {
          return GraphQLComponent.delegateToComponent(childComponent, {
            targetRootField: 'child',
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
        childField
        addedField
      }
        
      parent2: parent {
        anotherChildField
        addedField
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { parent1, parent2 } = result.data;

  t.deepEqual(parent1, { childField: 'Child Field', addedField: 'Added from Parent' }, 'received correct first result');
  t.deepEqual(parent2, { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }, 'received correct second result');
  t.end();
});

Test('delegateToComponent from root type resolver to child with different name and sub path', async (t) => {
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
        child(_root, _args, _context, info) {
          const selections = info.fieldNodes[0].selectionSet.selections.map((selectionNode) => { return selectionNode.name.value});
          t.equals(selections.indexOf('parentField'), -1, 'parent field not in sub path not included in child selection set');
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
      type Query {
        parent: Parent
      }
      type Child {
        addedField: String
      }
      type Parent {
        parentField: String
        child: Child
      }
    `,
    resolvers: {
      Query: {
        parent: async function (_, _args, context, info) {
          const child = GraphQLComponent.delegateToComponent(childComponent, {
            targetRootField: 'child',
            subPath: 'child',
            contextValue: context,
            info
          });
          return {
            parentField: 'parentField',
            child
          }
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
        parentField
        child { 
          childField
          addedField
        }
      }
        
      parent2: parent {
        parentField
        child {
          anotherChildField
          addedField
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.notOk(result.errors, 'no errors');
  
  const { parent1, parent2 } = result.data;

  t.deepEqual(parent1, { parentField: 'parentField', child: { childField: 'Child Field', addedField: 'Added from Parent' }}, 'received correct first result');
  t.deepEqual(parent2, { parentField: 'parentField', child: {anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }}, 'received correct second result');
  t.end();
});

Test('delegateToComponent from non-root type resolver to child with same name and no sub path', async (t) => {
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
  t.end();
});

Test('delegateToComponent from non-root type resolver to child with different name and no sub path', async (t) => {
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
        someParentField: Child
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
        someParentField(_, args, context, info) {
          return GraphQLComponent.delegateToComponent(childComponent, {
            targetRootField: 'child',
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
        someParentField {
          childField
          addedField
        }
      }
      parent2: parent {
        someParentField {
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

  t.deepEqual(parent1, { someParentField: { childField: 'Child Field', addedField: 'Added from Parent', }}, 'received correct first result');
  t.deepEqual(parent2, { someParentField: { anotherChildField: 'Another Child Field', addedField: 'Added from Parent' }}, 'received correct second result');
  t.end();
});

Test('delegateToComponent from non-root type resolver to child with different name and sub path', async (t) => {
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
        child(_root, _args, _context, info) {
          const selections = info.fieldNodes[0].selectionSet.selections.map((selectionNode) => { return selectionNode.name.value});
          t.equals(selections.indexOf('sopt'), -1, 'parent field not in sub path not included in child selection set');
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
      type Query {
        parent: Parent
      }
      type Child {
        addedField: String
      }
      type SomeOtherParentType {
        sopt: String
        child: Child
      }
      type Parent {
        someOtherParentType: SomeOtherParentType
      }
    `,
    resolvers: {
      Query: {
        parent: async function (){
          return {}
        }
      },
      Parent: {
        someOtherParentType(root, args, context, info) {
          const child = GraphQLComponent.delegateToComponent(childComponent, {
            targetRootField: 'child',
            subPath: 'child',
            contextValue: context,
            info
          });
          return { sopt: 'some other parent type value', child }
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
      parent {
        someOtherParentType {
          sopt
          child {
            childField
            anotherChildField
            addedField
          }
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.notOk(result.errors, 'no errors');
  t.deepEqual(result.data, { parent: { someOtherParentType: { sopt: 'some other parent type value', child: { childField: 'Child Field', anotherChildField: 'Another Child Field', addedField: 'Added from Parent'}}}}, 'complex delegation result resolved successfully');
  t.end();
});

Test('delegateToComponent with errors', async (t) => {
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
  t.end();
});

Test('delegateToComponent - return type is abstract (__typename not requested)', async (t) => {
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

  t.deepEquals(result.data.things, [{ id: '1', name: 'Joe Smith' }], 'interface type resolved');
  t.equals(resolveTypeCallCount, 1, '__resolveType called in child once per item in list');
  t.notOk(result.errors, 'no errors');
  t.end();
});

Test('delegateToComponent - return type is abstract (__typename requested)', async (t) => {
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
          },
          __typename
        }
      }
    `,
    schema: parent.schema,
    contextValue: {}
  });

  t.deepEquals(result.data.things, [{ id: '1', name: 'Joe Smith', __typename: 'Person' }], 'interface type resolved (including requested __typename)');
  t.equals(resolveTypeCallCount, 1, '__resolveType called in child once per item in list');
  t.notOk(result.errors, 'no errors');
  t.end();
});

Test('delegateToComponent - arg passed to delegated operation', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId(id: ID): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(args.id, '1', 'property id from parent resolver passed to child');
          return [{ id: 'revid', content: 'some review content'}];
        }
      }
    }
  });

  const property = new GraphQLComponent({
    types: `
      type Property {
        id: ID
        reviews: [Review]
      }

      type Query {
        propertyById(id: ID): Property
      }
    `,
    resolvers: {
      Query: {
        async propertyById(root, args, context, info) {
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviewsByPropertyId',
            subPath: 'reviews',
            info,
            contextValue: context
          })
          return { id: args.id, reviews: revs }
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        propertyById(id: 1) {
          id
          reviews {
            id
            content
          }
        }
      }
    `,
    schema: property.schema,
    contextValue: {}
  });
  t.deepEqual(result.data, { propertyById: { id: '1', reviews: [{ id: 'revid', content: 'some review content'}]}}, 'propery reviews successfully resolved');
  t.end();
});