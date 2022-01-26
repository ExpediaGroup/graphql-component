'use strict';

const Test = require('tape');
const gql = require('graphql-tag');
const { SchemaDirectiveVisitor } = require('@graphql-tools/utils');
const graphql = require('graphql');
const GraphQLComponent = require('./index');
const sinon = require('sinon');

Test('GraphQLComponent instance API (getters/setters)', (t) => {

  t.test('component name (anonymous constructor)', (st) => {
    const component = new GraphQLComponent();
    t.equals(component.name, 'GraphQLComponent', `unnamed constructor results in component named 'GraphQLComponent'`);
    st.end();
  })

  t.test('component name (named constructor)', (st) => {
    class Named extends GraphQLComponent {}
    const component = new Named();
    t.equals(component.name, 'Named', `named constructor results in 'Named'`);
    st.end();
  });

  t.test('component context', (st) => {
    const component = new GraphQLComponent();
    const context = component.context;
    st.ok(typeof context === 'function', 'context is a function');
    st.ok(typeof context.use === 'function', 'context has a use funtion');
    st.end();
  });

  t.test('component types', (st) => {
    const component = new GraphQLComponent({
      types: `type Query { a: String }`,
      imports: [new GraphQLComponent({
        types: `type Query { b: B } type B { someField: String}`}
      )]
    });

    st.deepEquals(component.types, [`type Query { a: String }`], `only the component's own types are returned`);
    st.end();
  });

  t.test('component resolvers', (st) => {
    const component = new GraphQLComponent({
      resolvers: {
        Query: {
          a() { return 'hello'}
        }
      },
      imports: [new GraphQLComponent({
        resolvers: {
          Query: {
            b() {
              return 'goodbye';
            }
          }
        }
      })]
    });

    st.equals(Object.keys(component.resolvers.Query).length, 1, `only the component's own resolvers are returned`);
    st.end();
  });

  t.test('component imports', (st) => {
    const childThatAlsoHasImports = new GraphQLComponent({
      types: `type Query { c: String }`,
      resolvers: { Query: { c() { return 'hello' }}},
      imports: [new GraphQLComponent()]
    });
    const root = new GraphQLComponent({
      imports: [
        childThatAlsoHasImports
      ]
    });
    st.equals(root.imports.length, 1, `only component's own imports are returned`);
    st.end();
  });

  t.test('component directives', (st) => {
    const component = new GraphQLComponent({
      directives: { parentDirective: () => {}},
      imports: [new GraphQLComponent({
        directives: { childDirective: () => {}}
      })]
    });

    st.equals(Object.keys(component.directives).length, 1, `only component's own directives are returned`);
    st.end();
  });

  t.test('component datasources', (st) => {
    const component = new GraphQLComponent({
      dataSources: ['parentDataSourcePlaceHolder'],
      imports: [new GraphQLComponent({
        dataSources: ['childDataSourcePlaceHolder']
      })]
    });

    st.equals(Object.keys(component.dataSources).length, 1, `only component's own dataSources are returned`);
    st.end();
  });
});

Test(`graphql-tools accessible from GraphQLComponent resolver 'this'`, async (t) => {
  const component = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        name: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          t.ok(this.graphqlTools, 'graphqlTools is defined on resolver this');
        }
      }
    }
  });

  const document = gql`
    query {
      foo {
        name
      }
    }
  `;

  await graphql.execute({
    document,
    schema: component.schema,
    contextValue: {}
  });
  t.end();
});

// mocks tests
Test(`default mocks applied to component's schema when mocks passed as boolean`, (t) => {
  const mockedSchemaComponent = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: Int
        b: Float
        c: String
        d: Boolean
      }
    `,
    mocks: true
  });

  const document = gql`
    query {
      foo {
        a
        b
        c
        d
      }
    }
  `;

  const { data: { foo } } = graphql.execute({
    document,
    schema: mockedSchemaComponent.schema,
    contextValue: {}
  });

  t.ok(typeof foo.a === 'number', 'Foo.a is random number');
  t.ok(typeof foo.b === 'number', 'Foo.b is random number');
  t.equal(foo.c, 'Hello World', 'Foo.c is Hello World');
  t.ok(typeof foo.d === 'boolean', 'Foo.d is boolean');
  t.end();
});

Test(`default mocks applied only to imported component's schema`, async (t) => {
  const mockedSchemaComponent = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: Int
        b: Float
        c: String
        d: Boolean
      }
    `,
    mocks: true
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        bar: Bar
      }

      type Bar {
        barField: String
        f: Foo
      }
    `,
    resolvers: {
      Query: {
        bar() {
          return {
            barField: 'barField',
          }
        }
      },
      Bar: {
        f(root, args, context, info) {
          return GraphQLComponent.delegateToComponent(mockedSchemaComponent, {
            operation: 'query',
            fieldName: 'foo',
            context,
            info
          });
        }
      }
    },
    imports: [mockedSchemaComponent]
  });

  const document = gql`
    query {
      bar {
        barField
        f {
          a
          b
          c
          d
        }
      }
    }
  `;

  const { data: { bar: { barField, f }} } = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });

  t.equals(barField, 'barField', 'non-mocked value in root component is present')
  t.ok(typeof f.a === 'number', 'Foo.a is random number');
  t.ok(typeof f.b === 'number', 'Foo.b is random number');
  t.equal(f.c, 'Hello World', 'Foo.c is Hello World');
  t.ok(typeof f.d === 'boolean', 'Foo.d is boolean');
  t.end();
});

Test('default mocks applied to imported and composite component', async (t) => {
  const mockedSchemaComponent = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: Int
        b: Float
        c: String
        d: Boolean
      }
    `,
    mocks: true
  });

  const composite = new GraphQLComponent({
    types: `
      type Query {
        bar: Bar
      }

      type Bar {
        barField: String
        f: Foo
        compositeMockedField: String
      }
    `,
    resolvers: {
      Query: {
        bar() {
          return {
            barField: 'barField',
          }
        }
      },
      Bar: {
        f(root, args, context, info) {
          return GraphQLComponent.delegateToComponent(mockedSchemaComponent, {
            operation: 'query',
            fieldName: 'foo',
            context,
            info
          });
        }
      }
    },
    imports: [mockedSchemaComponent],
    mocks: true
  });

  const document = gql`
    query {
      bar {
        barField
        f {
          a
          b
          c
          d
        }
        compositeMockedField
      }
    }
  `;

  const { data: { bar: { barField, f, compositeMockedField }} } = await graphql.execute({
    document,
    schema: composite.schema,
    contextValue: {}
  });

  t.equals(barField, 'barField', 'non-mocked value in root component is present');
  t.equals(compositeMockedField, 'Hello World', 'compositeMockedField is Hello World');
  t.ok(typeof f.a === 'number', 'Foo.a is random number');
  t.ok(typeof f.b === 'number', 'Foo.b is random number');
  t.equal(f.c, 'Hello World', 'Foo.c is Hello World');
  t.ok(typeof f.d === 'boolean', 'Foo.d is boolean');
  t.end();
});

Test(`custom mocks applied to component's schema when mocks passed as object`, (t) => {
  const mockedSchemaComponent = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: Int
        b: Float
        c: String
        d: Boolean
      }
    `,
    mocks: {
      Int: () => 123456789,
      Float: () => 3.1415926,
      String: () => 'custom string',
      Boolean: () => false
    }
  });

  const document = gql`
    query {
      foo {
        a
        b
        c
        d
      }
    }
  `;

  const { data: { foo } } = graphql.execute({
    document,
    schema: mockedSchemaComponent.schema,
    contextValue: {}
  });

  t.equal(foo.a, 123456789, 'Foo.a is a custom mocked Int');
  t.equal(foo.b, 3.1415926, 'Foo.b is custom mocked Float');
  t.equal(foo.c, 'custom string', 'Foo.c is a custom mocked string');
  t.equal(foo.d, false, 'Foo.d is a custom mocked boolean (false)');
  t.end();
});

// delegate tests
Test('delegate from root-type resolver', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a' };
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
        b: Int
      }
    `,
    resolvers: {
      Query: {
        async bar(root, args, context, info) {
          const subFoo = await GraphQLComponent.delegateToComponent(primitive, {
            operation: 'query',
            fieldName: 'foo',
            context,
            info
          });

          return { ...subFoo, b: 1 };
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
      }
    }
  `;

  const { data, errors } = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });

  t.deepEqual(data, { bar: { a: 'a', b: 1}}, 'expected result');
  t.notOk(errors, 'no errors')
  t.end();
});

Test('delegate from non root-type resolver', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a' };
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
        barField: String
        foo: Foo
      }
    `,
    resolvers: {
      Query: {
        async bar() {
          return { barField: 'barField' };
        }
      },
      Bar: {
        foo(root, args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            operation: 'query',
            fieldName: 'foo',
            context,
            info
          });
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      bar {
        barField
        foo {
          a
        }
      }
    }
  `;

  const { data, errors } = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });

  t.deepEqual(data, { bar: { barField: 'barField', foo: { a: 'a'}}}, 'expected result');
  t.notOk(errors, 'no errors')
  t.end();
});

Test('delegate results in non-root type field resolver running in delegatee', async (t) => {
  let fooFieldResolverCallCount = 0;
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: String
        fprime: FooPrime
      }

      type FooPrime {
        prime: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a', somethingToTransform: 'hello' };
        }
      },
      Foo: {
        fprime(root) {
          fooFieldResolverCallCount += 1;
          if (root.somethingToTransform) {
            return { prime: root.somethingToTransform };
          }
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
        compositeFooField: String
      }
    `,
    resolvers: {
      Query: {
        async bar(root, args, context, info) {
          const subFoo = await GraphQLComponent.delegateToComponent(primitive, {
            operation: 'query',
            fieldName: 'foo',
            context,
            info
          });
          return { ...subFoo, compositeFooField: 'compositeFooField' };
        }
      }
    },
    imports: [primitive]
  });

  const document = gql`
    query {
      bar {
        compositeFooField
        a
        fprime {
          prime
        }
      }
    }
  `;

  const { data, errors } = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });

  t.notOk(errors, 'no errors');
  t.deepEqual(data, { bar: { compositeFooField: 'compositeFooField', a: 'a', fprime: { prime: 'hello'}}}, 'expected result');
  t.equal(fooFieldResolverCallCount, 1, 'non root type field resolver in delegatee only called once');
  t.end();
});

Test('delegation resolves nested abstract type resolved without error', async (t) => {
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
        async foo() {
          return {};
        }
      },
      Foo: {
        things(_root, _args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            operation: 'query',
            fieldName: 'thingsById',
            info,
            context
          });
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

Test('error from delegatee propagated back to delegator and abstracted (looks like it came from resolver that called delegate)', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        b: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          throw new Error('db retrieval error');
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
        a: String
        b: String
      }
    `,
    resolvers: {
      Query: {
        bar(root, args, context, info) {
          return GraphQLComponent.delegateToComponent(primitive, {
            query: 'operation',
            fieldName: 'foo',
            context,
            info
          });
        }
      }
    }
  });

  const document = gql`
    query {
      bar {
        a
        b
      }
    }
  `;

  const { data, errors } = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });

  t.notOk(data.bar, 'bar is null as expected');
  t.equals(errors.length, 1, '1 error as expected');
  t.equals(errors[0].message, 'db retrieval error');
  t.deepEqual(errors[0].path, ['bar'], 'error path appears as though error came from delegateToComponent calling resolver');
  t.end();
});

Test('delegateToComponent maintains backwards compatibility for changed option keys (contextValue and targetRootField)', async (t) => {
  const primitive = new GraphQLComponent({
    types: `
      type Query {
        foo: Foo
      }

      type Foo {
        a: String
      }
    `,
    resolvers: {
      Query: {
        foo() {
          return { a: 'a' };
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
        b: Int
      }
    `,
    resolvers: {
      Query: {
        async bar(root, args, context, info) {
          const subFoo = await GraphQLComponent.delegateToComponent(primitive, {
            operation: 'query',
            targetRootField: 'foo',
            contextValue: context,
            info
          });

          return { ...subFoo, b: 1 };
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
      }
    }
  `;

  const { data, errors } = await graphql.execute({
    schema: composite.schema,
    document,
    contextValue: {}
  });

  t.deepEqual(data, { bar: { a: 'a', b: 1}}, 'expected result');
  t.notOk(errors, 'no errors')
  t.end();
});

// directive tests

// TODO: implement directive tests to test directive behavior between imports, etc

// federation tests
Test('components with federated schemas can be stitched locally by importing root', (t) => {
  const fedComponent1 = new GraphQLComponent({
    types: `
      type Query {
        property(id: ID!): Property
      }

      type Property @key(fields: "id") {
        id: ID!
        geo: [String]
      }
    `,
    resolvers: {
      Query: {
        property(_, {id}) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      }
    },
    federation: true
  });

  const fedComponent2 = new GraphQLComponent({
    types: `
      type Query {
        reviews(propertyId: ID!): [Review]
      }

      type Review @key(fields: "id") {
        id: ID!
        content: String
      }

      type Property {
        addedPropertyField: String
      }
    `,
    resolvers: {
      Query: {
        reviews() {
          return {
            id: 'rev-id-1',
            content: 'some-content'
          }
        }
      },
    },
    federation: true
  });

  const emptyRoot = new GraphQLComponent({
    imports: [fedComponent1, fedComponent2]
  });

  const { schema } = emptyRoot;

  console.log(graphql.printSchema(schema));
  const _serviceType = schema.getType('_Service');
  const _serviceTypeFields = _serviceType.getFields();
  const _entityType = schema.getType('_Entity');
  const _entityTypeTypes = _entityType.getTypes();
  const _anyScalar = schema.getType('_Any');
  const queryFields = schema.getType('Query').getFields();
  const propertyTypeFields = schema.getType('Property').getFields();

  t.ok(_serviceType, 'federated _Service type exists');
  t.ok(_serviceTypeFields['sdl'], '_Service type sdl field exists');
  t.ok(_entityType, 'federated _Entity type exists');
  t.equals(_entityTypeTypes.length, 2, '2 entities');
  t.deepEqual(_entityTypeTypes.map((e) => e.name), ['Property', 'Review'], 'entities are Property and Review as declared via @keys directive');
  t.ok(_anyScalar, 'scalar _Any exists');
  t.deepEqual(Object.keys(queryFields), ['_entities', '_service', 'property', 'reviews'], 'federated query fields and user declared query fields are present');
  t.deepEqual(Object.keys(propertyTypeFields), ['id', 'geo', 'addedPropertyField'], 'Property type fields is union between imported components (ie. property type is merged)');
  t.end();
});

Test(`importing root specifies 'federation: true' results in all components creating federated schemas`, (t) => {
  const fedComponent1 = new GraphQLComponent({
    types: `
      type Query {
        property(id: ID!): Property
      }

      type Property @key(fields: "id") {
        id: ID!
        geo: [String]
      }
    `,
    resolvers: {
      Query: {
        property(_, {id}) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      }
    },
  });

  const fedComponent2 = new GraphQLComponent({
    types: `
      type Query {
        reviews(propertyId: ID!): [Review]
      }

      type Review @key(fields: "id") {
        id: ID!
        content: String
      }

      type Property {
        addedPropertyField: String
      }
    `,
    resolvers: {
      Query: {
        reviews() {
          return {
            id: 'rev-id-1',
            content: 'some-content'
          }
        }
      },
    },
  });

  const emptyRoot = new GraphQLComponent({
    imports: [fedComponent1, fedComponent2],
    federation: true
  });

  const { schema: fedComponent1Schema } = fedComponent1;
  const _serviceTypeFedComponent1 = fedComponent1Schema.getType('_Service');
  const _serviceTypeFieldsFedComponent1 = _serviceTypeFedComponent1.getFields();
  const _entityTypeFedComponent1 = fedComponent1Schema.getType('_Entity');
  const _entityTypeTypesFedComponent1 = _entityTypeFedComponent1.getTypes();
  const _anyScalarFedComponent1 = fedComponent1Schema.getType('_Any');
  const queryFieldsFedComponent1 = fedComponent1Schema.getType('Query').getFields();

  t.ok(_serviceTypeFedComponent1, `federated _Service type exists in fedComponent1's federated schema`);
  t.ok(_serviceTypeFieldsFedComponent1['sdl'], `_Service type sdl field exists in fedComponent1's federated schema`);
  t.ok(_entityTypeFedComponent1, `federated _Entity type exists in fedComponent1's federated schema`);
  t.equals(_entityTypeTypesFedComponent1.length, 1, `1 entity in fedComponent1's federated schema`);
  t.ok(_anyScalarFedComponent1, `scalar _Any exists in fedComponent1's federated schema`);
  t.deepEqual(Object.keys(queryFieldsFedComponent1), ['_entities', '_service', 'property'], `federated query fields and user declared query fields are present in fedComponent1's federated schema`);
  t.ok(fedComponent1._federation, `federation flag is true in imported component, even though it was not set in imported component's constructor`);

  const { schema: fedComponent2Schema } = fedComponent1;
  const _serviceTypeFedComponent2 = fedComponent2Schema.getType('_Service');
  const _serviceTypeFieldsFedComponent2 = _serviceTypeFedComponent2.getFields();
  const _entityTypeFedComponent2 = fedComponent2Schema.getType('_Entity');
  const _entityTypeTypesFedComponent2 = _entityTypeFedComponent2.getTypes();
  const _anyScalarFedComponent2 = fedComponent2Schema.getType('_Any');
  const queryFieldsFedComponent2 = fedComponent2Schema.getType('Query').getFields();

  t.ok(_serviceTypeFedComponent2, `federated _Service type exists in fedComponent2's federated schema`);
  t.ok(_serviceTypeFieldsFedComponent2['sdl'], `_Service type sdl field exists in fedComponent2's federated schema`);
  t.ok(_entityTypeFedComponent2, `federated _Entity type exists in fedComponent1's federated schema`);
  t.equals(_entityTypeTypesFedComponent2.length, 1, `1 entity in fedComponent2's federated schema`);
  t.ok(_anyScalarFedComponent2, `scalar _Any exists in fedComponent1's federated schema`);
  t.deepEqual(Object.keys(queryFieldsFedComponent2), ['_entities', '_service', 'property'], `federated query fields and user declared query fields are present in fedComponent2's federated schema`);
  t.ok(fedComponent2._federation, `federation flag is true in imported component, even though it was not set in imported component's constructor`);

  const { schema } = emptyRoot;

  const _serviceType = schema.getType('_Service');
  const _serviceTypeFields = _serviceType.getFields();
  const _entityType = schema.getType('_Entity');
  const _entityTypeTypes = _entityType.getTypes();
  const _anyScalar = schema.getType('_Any');
  const queryFields = schema.getType('Query').getFields();
  const propertyTypeFields = schema.getType('Property').getFields();

  t.ok(_serviceType, 'federated _Service type exists in root federated schema');
  t.ok(_serviceTypeFields['sdl'], '_Service type sdl field exists in root federated schema');
  t.ok(_entityType, 'federated _Entity type exists in root federated schema');
  t.equals(_entityTypeTypes.length, 2, '2 entities in root federated schema');
  t.deepEqual(_entityTypeTypes.map((e) => e.name), ['Property', 'Review'], 'entities are Property and Review as declared via @keys directive in root federated schema in root federated schema');
  t.ok(_anyScalar, 'scalar _Any exists');
  t.deepEqual(Object.keys(queryFields), ['_entities', '_service', 'property', 'reviews'], 'federated query fields and user declared query fields are present in root federated schema');
  t.deepEqual(Object.keys(propertyTypeFields), ['id', 'geo', 'addedPropertyField'], 'Property type fields is union between imported components (ie. property type is merged) in root federated schema');
  t.end();
})

Test('federated schema can include custom directive', (t) => {
  class CustomDirective extends SchemaDirectiveVisitor {
    // required for our dummy "custom" directive (ie. implement the SchemaDirectiveVisitor interface)
    visitFieldDefinition() {
      return;
    }
  }

  const component = new GraphQLComponent({
    types: `
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
    `,
    resolvers: {
      Query: {
        property(_, { id }) {
          return {
            id,
            geo: ['lat', 'long']
          }
        }
      },
    },
    directives: { custom: CustomDirective },
    federation: true
  });

  t.test('federated schema created without error', (t) => {
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

