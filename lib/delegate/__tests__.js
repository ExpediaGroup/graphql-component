const Test = require('tape');
const gql = require('graphql-tag');
const graphql = require('graphql');
const GraphQLComponent = require('../');

Test('contextValue not passed to delegateToComponent', async (t) => {
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
      a {
        aField
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
  t.equals(result.data.a, null, 'expected null response');
  t.equals(result.errors[0].message, 'delegateToComponent requires the contextValue from the calling resolver', 'meaningful error message regarding required contextValue is propagated');
  t.end();
});

Test('info not passed to delegateToComponent', async (t) => {
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
        a: async function (_, _args, context) {
          return GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context
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
      a {
        aField
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
  t.equals(result.data.a, null, 'expected null response');
  t.equals(result.errors[0].message, 'delegateToComponent requires the info object from the calling resolver', 'meaningful error message regarding required info object is propagated');
  t.end();
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

Test('delegateToComponent - nested abstract type is resolved without error', async (t) => {
  let resolveTypeCount = 0;
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        thingsById(id: ID): ThingsConnection
      }

      type ThingsConnection {
        edges: [ThingEdge]
      }

      type ThingEdge {
        node: Thing
      }

      interface Thing {
        id: ID
      }

      type Book implements Thing {
        id: ID
        title: String
      }

      type Mug implements Thing {
        id: ID
        material: String
      }
    `,
    resolvers: {
      Query: {
        thingsById() {
          return {
            edges: [
              {
                node: {
                  id: 1,
                  title: 'A tale of two cities'
                }
              },
              {
                node: {
                  id: 2,
                  material: 'ceramic'
                }
              }
            ]
          }
        }
      },
      Thing: {
        __resolveType(result) {
          resolveTypeCount += 1;
          if (result.title) {
            return 'Book'
          }
          else if (result.material) {
            return 'Mug'
          }
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        things: ThingsConnection
      }
    `,
    resolvers: {
      Query: {
        async foo(_root, _args, context, info) {
          const result = await GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'thingsById',
            info,
            contextValue: context,
            subPath: 'things'
          });
          return {things: result};
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      foo {
        things {
          edges {
            node {
              id
              ... on Book {
                title
              }
              ... on Mug {
                material
              }
            }
          }
        }
      }
    }
  `

  const { data, errors } = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });
  const expectedResult = {
    foo: {
      things: {
        edges: [
          {
            node: {
              id: '1',
              title: 'A tale of two cities'
            }
          },
          {
            node: {
              id: '2',
              material: 'ceramic'
            }
          }
        ]
      }
    }
  }
  t.deepEquals(data, expectedResult, 'data is resolved as expected');
  t.equals(resolveTypeCount, 2, '__resolveType called once per item as expected');
  t.notOk(errors, 'no errors');
  t.end();
})

Test('delegateToComponent - calling resolver arg is not passed when target root field does not have matching arg', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId: [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(Object.keys(args).length, 0, 'property id arg is not passed');
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

Test('delegateToComponent - calling resolver arg is passed if target root field has matching arg', async (t) => {
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
          t.equals(args.id, '1', 'property id from calling resolver is passed');
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

Test('delegateToComponent - user arg is passed and overrides calling resolver arg', async (t) => {
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
          t.equals(Object.keys(args).length, 1, 'only 1 arg is passed');
          t.equals(args.id, '2', 'id arg from delegateToComponent call is passed');
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
            contextValue: context,
            args: {id: 2}
          })
          return { id: args.id, reviews: revs };
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

Test('delegateToComponent - calling resolver and user provided arg are passed', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId(id: ID, limit: Int): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(args.id, '1', 'property id from calling resolver is passed');
          t.equals(args.limit, 10, 'limit arg from delegateToComponent is passed');
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
            contextValue: context,
            args: { limit: 10 }
          })
          return { id: args.id, reviews: revs };
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

Test('delegateToComponent - user provided args of various types: ID (as Int), ID (as string), String, Int, Float, Boolean, enum, input object are passed', async (t) => {
  const reviewsComponent = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      input Dates {
        from: String
        to: String
      }

      enum Status {
        PENDING
        COMPLETE
      }

      type Query {
        reviewsByPropertyId(
          id: ID!
          anotherId: ID!
          bool: Boolean!
          int: Int!
          float: Float!
          string: String!
          status: Status!
          dates: Dates!): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(Object.keys(args).length, 8, 'exactly 8 args passed');
          t.equals(args.id, '2', 'id ID arg (passed as number) from delegateToComponent call passed');
          t.equals(args.anotherId, '9', 'anotherId ID (passed as string) from delegateToComponent call passed');
          t.equals(args.bool, true, 'bool Boolean arg from delegateToComponent call passed');
          t.equals(args.int, 101, 'int Int arg from delegateToComponent call passed');
          t.equals(args.float, 49.2, 'float Float arg from delegateToComponent passed');
          t.equals(args.string, 'foobar', 'string String arg from delegateToComponent call passed');
          t.equals(args.status, 'COMPLETE', 'status enum arg from delegateToComponent call passed');
          t.deepEqual(args.dates, {from: 'from-date', to: 'to-date'}, 'dates input object arg from delegateToComponent call passed');
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
        propertyById() {
          return { id: 1 };
        }
      },
      Property: {
        async reviews(_root, _args, context, info) {
          const reviews = await GraphQLComponent.delegateToComponent(reviewsComponent, {
            info,
            contextValue: context,
            targetRootField: 'reviewsByPropertyId',
            args: { 
              id: 2,
              anotherId: '9',
              bool: true,
              int: 101,
              float: 49.2,
              string: 'foobar',
              status: 'COMPLETE',
              dates: { from: 'from-date', to: 'to-date' }
            }
          });
          return reviews;
        }
      }
    },
    imports: [reviewsComponent]
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

Test('delegateToComponent - user passes wrong type for arg', async (t) => {
  const reviewsComponent = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId(id: ID!): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId() {
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
        propertyById() {
          return { id: 1 };
        }
      },
      Property: {
        async reviews(_root, _args, context, info) {
          const reviews = await GraphQLComponent.delegateToComponent(reviewsComponent, {
            info,
            contextValue: context,
            targetRootField: 'reviewsByPropertyId',
            args: {
              id: true
            }
          });
          return reviews;
        }
      }
    },
    imports: [reviewsComponent]
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
  t.deepEqual(result.data, { propertyById: { id: '1', reviews: null } }, 'property partially resolves, reviews null');
  t.equal(result.errors[0].message, 'Invalid value true: Expected type ID. ID cannot represent value: true', 'type mismatch error propagated');
  t.end();
});

Test('delegateToComponent - target field non-nullable arg is not passed', async (t) => {
  const reviewsComponent = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId(id: ID!): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId() {
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
        propertyById() {
          return { id: 1 };
        }
      },
      Property: {
        async reviews(_root, _args, context, info) {
          const reviews = await GraphQLComponent.delegateToComponent(reviewsComponent, {
            info,
            contextValue: context,
            targetRootField: 'reviewsByPropertyId'
          });
          return reviews;
        }
      }
    },
    imports: [reviewsComponent]
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
  t.deepEqual(result.data, { propertyById: { id: '1', reviews: null } }, 'property partially resolves, reviews null');
  t.equal(result.errors[0].message, `Argument "id" of required type "ID!" was not provided.`, 'required arg error message is propagated');
  t.end();
});

Test('delegateToComponent - with errors', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: String!
        b: String!
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a', b: null };
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        bar: Foo
      }

      type Foo {
        c: String
      }
    `,
    resolvers: {
      Query: {
        async bar(_root, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'foo',
            contextValue: context,
            info
          });
        }
      },
      Foo: {
        c() {
          return 'c';
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      abc: bar {
        a
        b
        c
      }
      bca: bar {
        b
        c
        a
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });
  t.equal,(result.data.abc, null, 'abc query resolves as expected');
  t.equal(result.data.bca, null, 'bca query resolves as expected');
  t.equal(result.errors.length, 2, '2 errors returned');
  t.equal(result.errors[0].message, result.errors[1].message, 'errors are equal (Foo.b not nullable) regardless of differing selection set ordering');
  t.end();
});

Test('delegateToComponent - with errors - delegate graphql data result is completely null (return type of target field is not nullable)', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo!
      }

      type Foo {
        a: String!
        b: String!
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a', b: null };
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        bar: Foo
      }

      type Foo {
        c: String
      }
    `,
    resolvers: {
      Query: {
        async bar(_root, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            targetRootField: 'foo',
            contextValue: context,
            info
          });
        }
      },
      Foo: {
        c() {
          return 'c';
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      bar {
        a
        b
        c
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });
  t.equal(result.data.bar, null, 'query resolves as expected');
  t.equal(result.errors.length, 1, '1 error returned');
  t.equal(result.errors[0].message, 'Cannot return null for non-nullable field Foo.b.', 'expected error is propagated regardless of completely null delegate result');
  t.end();
});

