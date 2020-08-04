const Test = require('tape');
const gql = require('graphql-tag');
const graphql = require('graphql');
const GraphQLComponent = require('../');

Test('integration - composite automatically delegates to root primitive field via delegateToComponent', async (t) => {

  t.plan(1);

  const composite = new GraphQLComponent({
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
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });
  
  t.equal(data.test.value, true, 'resolved');
});

Test('composite component delegates from root type resolver to primitive component field with same name, no sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a() {
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type A {
        addedField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a: async function (_, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info
          });
        }
      },
      A: {
        addedField() {
          return 'added field'
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query { 
      composite1: a {
        aField
        addedField
      }
        
      composite2: a {
        anotherAField
        addedField
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { composite1, composite2 } = result.data;

  t.deepEqual(composite1, { aField: 'a field', addedField: 'added field' }, 'received correct first result');
  t.deepEqual(composite2, { anotherAField: 'another a field', addedField: 'added field' }, 'received correct second result');
  t.end();
});

Test('composite delegates from root type resolver to primitive component field with different name, no sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a() {
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type A {
        addedField: String
      }
      type Query {
        b: A
      }
    `,
    resolvers: {
      Query: {
        b: async function (_, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'a',
            contextValue: context,
            info
          });
        }
      },
      A: {
        addedField() {
          return 'added field'
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query { 
      composite1: b {
        aField
        addedField
      }
        
      composite2: b {
        anotherAField
        addedField
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { composite1, composite2 } = result.data;

  t.deepEqual(composite1, { aField: 'a field', addedField: 'added field' }, 'received correct first result');
  t.deepEqual(composite2, { anotherAField: 'another a field', addedField: 'added field' }, 'received correct second result');
  t.end();
});

Test('composite component delegates from root type resolver to primitive component field with different name, with sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a(_root, _args, _context, info) {
          const selections = info.fieldNodes[0].selectionSet.selections.map((selectionNode) => { return selectionNode.name.value});
          t.equals(selections.indexOf('bField'), -1, 'parent field not in sub path not included in child selection set');
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b: B
      }
      type A {
        addedField: String
      }
      type B {
        bField: String
        a: A
      }
    `,
    resolvers: {
      Query: {
        b: async function (_, _args, context, info) {
          const a = GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'a',
            subPath: 'a',
            contextValue: context,
            info
          });
          return {
            bField: 'b field',
            a
          }
        }
      },
      A: {
        addedField() {
          return 'added field';
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query { 
      composite1: b {
        bField
        a { 
          aField
          anotherAField
        }
      }
        
      composite2: b {
        bField
        a {
          anotherAField
          addedField
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.notOk(result.errors, 'no errors');
  
  const { composite1, composite2 } = result.data;

  t.deepEqual(composite1, { bField: 'b field', a: { aField: 'a field', anotherAField: 'another a field' }}, 'received correct first result');
  t.deepEqual(composite2, { bField: 'b field', a: { anotherAField: 'another a field', addedField: 'added field' }}, 'received correct second result');
  t.end();
});

Test('composite component delegates from non-root type resolver to primitive component field with same name, no sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a() {
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type B {
        a: A
      }
      type A {
        addedField: String
      }
      type Query {
        b: B
      }
    `,
    resolvers: {
      Query: {
        b: async function () {
          return {};
        }
      },
      B: {
        a(_, args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info
          });
        }
      },
      A: {
        addedField() {
          return 'added field'
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query { 
      composite1: b {
        a {
          aField
          addedField
        }
      }
      composite2: b {
        a {
          anotherAField
          addedField
        }
      }
    }`;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { composite1, composite2 } = result.data;

  t.deepEqual(composite1, { a: { aField: 'a field', addedField: 'added field', }}, 'received correct first result');
  t.deepEqual(composite2, { a: { anotherAField: 'another a field', addedField: 'added field' }}, 'received correct second result');
  t.end();
});

Test('composite component delegates from non-root type resolver to primitive component field with different name, no sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a() {
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type B {
        bField: A
      }
      type A {
        addedField: String
      }
      type Query {
        b: B
      }
    `,
    resolvers: {
      Query: {
        b: async function () {
          return {};
        }
      },
      B: {
        bField(_, args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'a',
            contextValue: context,
            info
          });
        }
      },
      A: {
        addedField() {
          return 'added field'
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query { 
      composite1: b {
        bField {
          aField
          addedField
        }
      }
      composite2: b {
        bField {
          anotherAField
          addedField
        }
      }
    }`;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.ok(!result.errors, 'no errors');
  
  const { composite1, composite2 } = result.data;

  t.deepEqual(composite1, { bField: { aField: 'a field', addedField: 'added field', }}, 'received correct first result');
  t.deepEqual(composite2, { bField: { anotherAField: 'another a field', addedField: 'added field' }}, 'received correct second result');
  t.end();
});

Test('composite component delegates from non-root type resolver to primitive component field with different name, with sub path', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type A {
        aField: String
        anotherAField: String
      }
      type Query {
        a: A
      }
    `,
    resolvers: {
      Query: {
        a(_root, _args, _context, info) {
          const selections = info.fieldNodes[0].selectionSet.selections.map((selectionNode) => { return selectionNode.name.value});
          t.equals(selections.indexOf('compositeBField'), -1, 'parent field not in sub path not included in child selection set');
          return {
            aField: 'a field',
            anotherAField: 'another a field'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b: B
      }
      type A {
        addedField: String
      }
      type CompositeB {
        compositeBField: String
        a: A
      }
      type B {
        compositeB: CompositeB
      }
    `,
    resolvers: {
      Query: {
        b: async function (){
          return {}
        }
      },
      B: {
        async compositeB(_root, _args, context, info) {
          const a = GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'a',
            subPath: 'a',
            contextValue: context,
            info
          });
          return { compositeBField: 'composite b field', a }
        }
      },
      A: {
        addedField() {
          return 'added field'
        }
      }
    },
    imports: [
      primitive
    ]
  });

  const document = gql`
    query {
      b {
        compositeB {
          compositeBField
          a {
            aField
            anotherAField
            addedField
          }
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.notOk(result.errors, 'no errors');
  t.deepEqual(result.data, { b: { compositeB: { compositeBField: 'composite b field', a: { aField: 'a field', anotherAField: 'another a field', addedField: 'added field'}}}}, 'complex delegation result resolved successfully');
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

Test('delegateToComponent - return type is not nullable and error occurs', async (t) => {
  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        types: `
          type Test {
            value: Boolean
          }
          type Query {
            test: Test!
          }
        `,
        resolvers: {
          Query: {
            test() {
              throw new Error('some error');
            }
          }
        }
      })
    ]
  });

  const document = gql`
    query { 
      test {
        value
      }
    }`;

  const { data, errors } = await graphql.execute({
    document,
    schema: component.schema,
    rootValue: undefined,
    contextValue: {}
  });

  t.equal(data, null, 'data is null');
  t.equal(errors.length, 1, '1 error returned');
  t.equal(errors[0].message, 'some error', 'error message is error from resolver that threw');

  t.end();
})

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

Test('delegateToComponent - calling resolver args are passed to primitive component (reviews) field', async (t) => {
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