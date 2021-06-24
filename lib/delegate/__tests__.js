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
        a(_, _args, context, info) {
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
  let materialNonRootResolverCount = 0;
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
            return 'Book';
          }
          return 'Mug';
        }
      },
      Mug: {
        material() {
          materialNonRootResolverCount += 1;
          return 'ceramic';
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
  t.equals(materialNonRootResolverCount, 1, 'Mug non-root resolver is only executed 1 time as expected');
  t.notOk(errors, 'no errors');
  t.end();
});

// argument forwarding tests:

/*
 * case 1: target field has no arguments and calling resolver has no arguments
 * result: no arguments are forwarded even if caller of delegateToComponent
 * provides them
*/
Test('delegateToComponent - case 1 - no args provided to delegateToComponent', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviews: [Review]
      }
    `,
    resolvers: {
      Query: {
        reviews(_root, args) {
          t.equals(Object.keys(args).length, 0, 'no args forwarded to target field');
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
        property: Property
      }
    `,
    resolvers: {
      Query: {
        async property(_root, _args, context, info) {
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviews',
            subPath: 'reviews',
            info,
            contextValue: context
          })
          return { id: '1', reviews: revs };
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        property {
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
  t.deepEqual(result.data, { property: { id: '1', reviews: [{ id: 'revid', content: 'some review content'}]}}, 'propery reviews successfully resolved');
  t.end();
});

Test('delegateToComponent - case 1 - args provided to delegateToComponent', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviews: [Review]
      }
    `,
    resolvers: {
      Query: {
        reviews(_root, args) {
          t.equals(Object.keys(args).length, 0, 'no args forwarded to target field');
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
        property: Property
      }
    `,
    resolvers: {
      Query: {
        async property(_root, _args, context, info) {
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviews',
            subPath: 'reviews',
            info,
            contextValue: context,
            args: {
              foo: 'bar'
            }
          })
          return { id: '1', reviews: revs };
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        property {
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
  t.deepEqual(result.data, { property: { id: '1', reviews: [{ id: 'revid', content: 'some review content'}]}}, 'propery reviews successfully resolved');
  t.end();
})

/*
 * case 2: target field has no arguments and calling resolver has arguments
 * result: no arguments are forwarded from calling resolver or from the caller
 * of delegateToComponent if provided
*/
Test('delegateToComponent - case 2 - no args provided to delegateToComponent', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviews: [Review]
      }
    `,
    resolvers: {
      Query: {
        reviews(_root, args) {
          t.equals(Object.keys(args).length, 0, 'no args forwarded to target field');
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
        async propertyById(_root, args, context, info) {
          t.ok(args.id, 'argument present in delegating resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviews',
            subPath: 'reviews',
            info,
            contextValue: context
          })
          return { id: '1', reviews: revs };
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

Test('delegateToComponent - case 2 - args provided to delegateToComponent', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviews: [Review]
      }
    `,
    resolvers: {
      Query: {
        reviews(_root, args) {
          t.equals(Object.keys(args).length, 0, 'no args forwarded to target field');
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
        async propertyById(_root, args, context, info) {
          t.ok(args.id, 'argument present in delegating resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviews',
            subPath: 'reviews',
            info,
            contextValue: context,
            args: {
              foo: 'bar'
            }
          })
          return { id: '1', reviews: revs };
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

/*
* case 3: target field has arguments and calling resolver has arguments
* result: matching args to the target field provided by the caller of
* delegateToComponent take priority and are forwarded, otherwise falling back
* to matching args from the calling resolver, no other args are forwarded
*/

Test('delegateToComponent - case 3 - calling resolver has matching args/extra args, no args provided to delegateToComponent', async (t) => {
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
          t.equals(Object.keys(args).length, 1, '1 arg forwarded to target field');
          t.ok(args.id, 'id arg from calling resolver forwarded');
          t.notOk(args.cached, 'cached arg from calling resolver is not forwarded');
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
        propertyById(id: ID!, cached: Boolean!): Property
      }
    `,
    resolvers: {
      Query: {
        async propertyById(_root, args, context, info) {
          t.ok(args.id, 'id argument present in delegating resolver');
          t.ok(args.cached, 'cached argument present in resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviewsByPropertyId',
            subPath: 'reviews',
            info,
            contextValue: context,
          })
          return { id: '1', reviews: revs };
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        propertyById(id: 1, cached: true) {
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

Test('delegateToComponent - case 3 - calling resolver has matching args/extra args, rest of target args provided by delegateToComponent caller', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsByPropertyId(id: ID, foo: String, bar: String): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(Object.keys(args).length, 3, '3 args forwarded to target field');
          t.ok(args.id, 'id arg from calling resolver forwarded');
          t.equals(args.id, '1', 'args.id value is 1 from calling resolver');
          t.equals(args.foo, 'foo', 'args.foo provided by delegateToComponent caller is passed with expected value');
          t.equals(args.bar, 'bar', 'args.bar provided by delegateToComponent caller is passed with expected value');
          t.notOk(args.cached, 'args.cached from calling resolver is not forwarded');
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
        propertyById(id: ID!, cached: Boolean!): Property
      }
    `,
    resolvers: {
      Query: {
        async propertyById(_root, args, context, info) {
          t.ok(args.id, 'id argument present in delegating resolver');
          t.ok(args.cached, 'cached argument present in resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviewsByPropertyId',
            subPath: 'reviews',
            info,
            contextValue: context,
            args: {
              foo: 'foo',
              bar: 'bar'
            }
          });
          return { id: '1', reviews: revs };
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        propertyById(id: 1, cached: true) {
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

Test('delegateToComponent - case 3 - calling resolver has a matching arg/no extra args, but matching arg is overridden by arg passed to delegateToComponent', async (t) => {
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
          t.equals(Object.keys(args).length, 1, '1 arg forwarded to target field');
          t.equals(args.id, '2', 'id arg from calling resolver forwarded and has overridden value');
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
        propertyById(id: ID!): Property
      }
    `,
    resolvers: {
      Query: {
        async propertyById(_root, args, context, info) {
          t.ok(args.id, 'id argument present in delegating resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviewsByPropertyId',
            subPath: 'reviews',
            info,
            contextValue: context,
            args: {
              id: '2'
            }
          })
          return { id: '1', reviews: revs };
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

/*
* case 4: target field has arguments and calling resolver has no arguments
* result: caller of delegateToComponent must provide args to forward and will
* be forwarded if provided
*/

Test('delegateToComponent - case 4 - delegateToComponent caller provides all args to target field', async (t) => {
  const reviews = new GraphQLComponent({
    types: `
      type Review {
        id: ID
        content: String
      }

      type Query {
        reviewsById(id: ID!, foo: String!): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsById(_root, args) {
          t.equals(Object.keys(args).length, 2, '2 args forwarded to target field');
          t.equals(args.id, '2', 'id arg forwarded and has value passed to delegateToComponent');
          t.equals(args.foo, 'foo', 'foo arg forwarded and has value passed to delegateToComponent');
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
        property: Property
      }
    `,
    resolvers: {
      Query: {
        async property(_root, args, context, info) {
          t.equals(Object.keys(args).length, 0, 'no args present in delegateing resolver');
          const revs = await GraphQLComponent.delegateToComponent(reviews, {
            targetRootField: 'reviewsById',
            subPath: 'reviews',
            info,
            contextValue: context,
            args: {
              id: '2',
              foo: 'foo'
            }
          })
          return { id: '1', reviews: revs };
        }
      }
    },
    imports: [reviews]
  });

  const result = await graphql.execute({
    document: gql`
      query {
        property {
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
  t.deepEqual(result.data, { property: { id: '1', reviews: [{ id: 'revid', content: 'some review content'}]}}, 'propery reviews successfully resolved');
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
          intID: ID!
          stringID: ID!
          bool: Boolean!
          int: Int!
          float: Float!
          string: String!
          status: Status!
          dates: Dates!
          arrayOfIntID: [ID!]!
          arrayOfStringID: [ID!]!
          arrayOfInt: [Int!]!
          arrayOfFloat: [Float!]!
          arrayOfString: [String!]!
          arrayOfEnum: [Status!]!
          arrayOfObj: [Dates!]!
        ): [Review]
      }
    `,
    resolvers: {
      Query: {
        reviewsByPropertyId(_root, args) {
          t.equals(Object.keys(args).length, 15, 'exactly 15 args passed');
          t.equals(args.intID, '2', 'intID arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.stringID, '9', 'stringID arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.bool, true, 'bool arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.int, 101, 'int arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.float, 49.2, 'float arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.string, 'foobar', 'string arg from delegateToComponent coerced and passed through as expected');
          t.equals(args.status, 'COMPLETE', 'status arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.dates, { from: 'from-date', to: 'to-date' }, 'dates arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfIntID, ['1', '2'], 'arrayOfIDInt arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfStringID, ['3a', '4a'], 'arrayOfIDString arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfInt, [5, 6], 'arrayOfInt arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfFloat, [7.0, 8.0], 'arrayOfFloat arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfString, ['hello', 'goodbye'], 'arrayOfString arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfEnum, ['COMPLETE', 'PENDING'], 'arrayOfEnum arg from delegateToComponent coerced and passed through as expected');
          t.deepEqual(args.arrayOfObj, [{ from: 'from-date-1', to: 'to-date-1' }, { from: 'from-date-2', to: 'to-date-2' }], 'arrayOfObj arg from delegateToComponent coerced and passed through as expected');
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
              intID: 2,
              stringID: '9',
              bool: true,
              int: 101,
              float: 49.2,
              string: 'foobar',
              status: 'COMPLETE',
              dates: { from: 'from-date', to: 'to-date' },
              arrayOfIntID: [1, 2],
              arrayOfStringID: ['3a', '4a'],
              arrayOfInt: [5, 6],
              arrayOfFloat: [7.0, 8.0],
              arrayOfString: ['hello', 'goodbye'],
              arrayOfEnum: ['COMPLETE', 'PENDING'],
              arrayOfObj: [{ from: 'from-date-1', to: 'to-date-1'}, {from: 'from-date-2', to: 'to-date-2'}]
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
  t.equal(result.errors.length, 1, '1 error returned')
  t.equal(result.errors[0].message, `Argument "id" of required type "ID!" was not provided.`, 'required arg error message is propagated');
  t.deepEqual(result.errors[0].path, ['propertyById', 'reviews'], 'error path is as expected');
  t.end();
});

Test('delegateToComponent - with errors (selection set order doesnt matter)', async (t) => {
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
      },
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
  t.equal(result.errors[0].message, result.errors[1].message, 'error messages are equal (Foo.b not nullable) regardless of differing selection set ordering');
  t.deepEqual(result.errors[0].path, ['abc', 'b'], 'first error has path as expected');
  t.deepEqual(result.errors[1].path, ['bca', 'b'], 'second error has path as expected');
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
  t.deepEqual(result.errors[0].path, ['bar', 'b'], `error's path has expected value`);
  t.end();
});

Test('delegateToComponent - errors merged as expected for non-nullable list that allows nullable items', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foos: [Foo]!
      }

      type Foo {
        a: String!
      }
    `,
    resolvers: {
      Query: {
        foos() {
          return [ { a: 'bar'} , {}, { a: 'baz'} ];
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        bar: Bar
      }

      type Bar {
        foos: [Foo]!
      }
    `,
    resolvers: {
      Query: {
        async bar(_root, _args, context, info) {
          const foos = await GraphQLComponent.delegateToComponent(primitive, {
            info,
            contextValue: context,
            targetRootField: 'foos',
            subPath: 'foos'
          });
          return { foos };
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      bar {
        foos {
          a
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });

  t.deepEqual(result.data.bar.foos[0], { a: 'bar' }, 'first item of list resolved as expected');
  t.deepEqual(result.data.bar.foos[1], null, 'second item is null as expected');
  t.deepEqual(result.data.bar.foos[2], { a: 'baz' }, 'third item of list resolved as expected');
  t.equal(result.errors.length, 1, 'one error returned');
  t.equal(result.errors[0].message, 'Cannot return null for non-nullable field Foo.a.');
  t.deepEqual(result.errors[0].path, ['bar', 'foos', 1, 'a'], `error's path has expected value`);
  t.end();
});

Test('delegateToComponent - with errors - verify error path when delegation occurs from non-root resolver', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        a: A
      }

      type A {
        aField: String
      }
    `,
    resolvers: {
      Query: {
        a() {
          throw new Error('error retrieving A');
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b: B
      }

      type B {
        a: A
        bField: String
      }
    `,
    resolvers: {
      Query: {
        b() {
          return { bField: 'bField' };
        }
      },
      B: {
        a(_root, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info,
            subPath: 'a'
          });
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      b {
        a {
          aField
        }
        bField
      }
    }
  `;

  const result = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });
  t.equal(result.data.b.a, null, 'b.a is null as expected due to error');
  t.equal(result.data.b.bField, 'bField', `b's field resolved as expected`);
  t.equal(result.errors.length, 1, '1 error returned');
  t.equal(result.errors[0].message, 'error retrieving A');
  t.deepEqual(result.errors[0].path, ['b', 'a']);
  t.end();
});

Test(`delegateToComponent - variable in outer query for type that doesn't exist in schema being delegated to`, async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        a(aone: Int, atwo: String): A
      }

      type A {
        aField: String
      }
    `,
    resolvers: {
      Query: {
        a() {
          return { aField: 'aField' };
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b(bone: Int, btwo: C): B
      }

      type B {
        a: A
        bField: String
      }

      enum C {
        CONE
        CTWO
      }
    `,
    resolvers: {
      Query: {
        async b(_root, args, context, info) {
          const a = await GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info,
            targetRootField: 'a',
            subPath: 'a',
            args: {
              aone: args.bone,
              atwo: args.btwo
            }
          });
          return { a, bField: 'bField' };
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query something($first: Int, $second: C, $third: Boolean) {
      b(bone: $first, btwo: $second) {
        a {
          aField
        }
        bField
      }
    }
  `;

  const result = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {},
    variableValues: {
      first: 1,
      second: 'CONE',
      third: true
    }
  });

  t.notOk(result.errors, 'no errors');
  t.deepEqual(result.data.b, { a: { aField: 'aField'}, bField: 'bField' }, 'result resolved as expected');
  t.end();
});

Test(`delegateToComponent - variables are present in delegated selection set`, async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        a(aone: Int, atwo: String): A
      }

      type A {
        aField: String
      }
    `,
    resolvers: {
      Query: {
        a(_root, args, _context, info) {
          t.equal(args.aone, 1, 'variable from outer query is passed from non-root resolver who called delegate');
          t.equal(args.atwo, 1, 'variable from outer query is passed from non-root resolver who called delegate');
          t.equal(info.operation.variableDefinitions.length, 1, 'only 1 variable definition forwarded');
          t.equal(info.operation.variableDefinitions[0].variable.name.value, 'first', '$first variable definition is forwarded as it is only one used');
          return { aField: 'aField' };
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b(bone: Int, btwo: C): B
      }

      type B {
        a(aone: Int, atwo: Int): A
        bField: String
      }

      enum C {
        CONE
        CTWO
      }
    `,
    resolvers: {
      Query: {
        async b() {
          return { bField: 'bField' };
        }
      },
      B: {
        async a(root, args, context, info) {
          const a = await GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info
          });
          return a;
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query something($first: Int, $second: C, $third: Boolean) {
      b(bone: $first, btwo: $second) {
        a(aone: $first, atwo: $first) {
          aField
        }
        bField
      }
    }
  `;

  const result = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {},
    variableValues: {
      first: 1,
      second: 'CONE',
      third: true
    }
  });

  t.notOk(result.errors, 'no errors');
  t.deepEqual(result.data.b, { a: { aField: 'aField'}, bField: 'bField' }, 'result resolved as expected');
  t.end();
});

Test('delegateToComponent - delegated selection set from root resolver contains fields that are not in schema being delegated to (pruning)', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        a(foo: String): A
      }

      type A {
        aField1: String
      }

      type B {
        bField: String
      }
    `,
    resolvers: {
      Query: {
        a(_root, _args, _context, info) {
          t.equal(info.fieldNodes[0].selectionSet.selections.length, 1, 'only 1 field in the selection set');
          t.equal(info.fieldNodes[0].selectionSet.selections[0].name.value, 'aField1', 'expected only aField1 in selection set');
          return { aField1: 'aField1'}
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        aById(id: ID): A
      }

      type A {
        b(bArg: Int!): B
      }
    `,
    resolvers: {
      Query: {
        async aById(root, args, context, info) {
          const a = await GraphQLComponent.delegateToComponent(primitive, {
            info,
            contextValue: context,
            targetRootField: 'a'
          })
          return { ...a, b: { bField: 'bField' }};
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query aQuery($id: ID, $barg: Int!) {
      aById(id: $id) {
        aField1
        b(bArg: $barg) {
          bField
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {},
    variableValues: {
      id: 1,
      barg: 2
    }
  });
  t.notOk(result.errors, 'no errors');
  t.deepEquals(result.data, { aById: { aField1: 'aField1', b: { bField: 'bField'}}}, 'result resolved as expected');
  t.end();
});

Test('delegateToComponent - delegated selection set from non-root resolver contains fields that are not in schema being delegated to (pruning)', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        a: A
      }

      type A {
        aField1: String
      }
    `,
    resolvers: {
      Query: {
        a(_root, _args, _context, info) {
          t.equal(info.fieldNodes[0].selectionSet.selections.length, 1, 'only 1 field in the selection set');
          t.equal(info.fieldNodes[0].selectionSet.selections[0].name.value, 'aField1', 'expected only aField1 in selection set');
          return { aField1: 'aField1'};
        }
      }
    }
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        b: B
      }

      type B {
        a: APrime
      }

      type APrime {
        aField1: String
        aPrimeField1: String
      }
    `,
    resolvers: {
      Query: {
        async b() {
          return {};
        }
      },
      B: {
        async a(_root, _args, context, info) {
          const a = await GraphQLComponent.delegateToComponent(primitive, {
            contextValue: context,
            info
          });
          return {...a, aPrimeField1: 'aPrimeField1'};
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      b {
        a {
          aField1
          aPrimeField1
        }
      }
    }
  `;

  const result = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });
  t.notOk(result.errors, 'no errors');
  t.deepEquals(result.data, { b: { a: { aField1: 'aField1', aPrimeField1: 'aPrimeField1'}}}, 'result resolved as expected');
  t.end();
});