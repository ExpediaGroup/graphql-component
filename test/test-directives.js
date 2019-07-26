'use strict';

const Test = require('tape');
const { SchemaDirectiveVisitor } = require('graphql-tools');

const GraphQLComponent = require('../lib/index');
const Directives = require('../lib/directives');

class TestDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {}
}

const componentA = new GraphQLComponent({
  types: [`
      directive @constraint(schema: String!) on FIELD_DEFINITION
      type Book {
        id: ID!
        title: String
      }
      type Query {
        book(id: ID!) : Book
      }
    `],
  resolvers: {
    Query: {
      book() {
        return {id: 1, title: 'Some Title'}
      }
    }
  },
  directives: {constraint: TestDirective}
});

const componentB = new GraphQLComponent({
  types: [`
      directive @authorization(schema: String!) on FIELD_DEFINITION
      type Author {
        id: ID!
        name: String
        books: [Book]
      }
      type Query {
        author(id: ID!) : Author
      }
    `],
  resolvers: {
    Query: {
      author() {
        return {
          id: 1, name: 'Some Author',
          books: [{id: 1, title: 'Some Title'}]
        };
      }
    }
  },
  imports: [
    componentA
  ],
  directives: {authorization: TestDirective}
});

Test('test componentA', async (t) => {
  t.test('componentA construct', async (t) => {
    t.plan(3);

    const directives = {};
    directives[`constraint_${componentA._id}`] = TestDirective;

    t.deepEquals(componentA.directives, directives, 'has constraint directive in directives');
    t.deepEquals(componentA._importedDirectives, [], 'imported directives are empty');
    t.deepEquals(componentA._mergedDirectives, directives, 'has constraint directive in merged directives');
  });

  t.test('componentA schema', async (t) => {
    t.plan(3);

    t.ok(componentA.schema._directives, 'has directives');

    const constraintDirective = componentA.schema._directives.filter((d) => {
      return d.name.startsWith("constraint");
    });

    t.ok(constraintDirective, 'has directives in schema');
    t.equal(constraintDirective.length, 1, 'has constraint directive in schema');
  });

  t.test('componentA execute', async (t) => {
    t.plan(3);

    const query = `
      query {
        book(id: 1) {id, title}
      }
    `;

    const result = await componentA.execute(query);

    t.ok(result, 'has result');
    t.ok(result.data, 'data returned');
    t.error(result.errors, 'no errors');
  });
});

Test('test componentB', async (t) => {
  t.test('componentB construct', async (t) => {
    t.plan(3);

    const directives = {};
    directives[`authorization_${componentB._id}`] = TestDirective;

    const importedDirectives = {};
    importedDirectives[`constraint_${componentA._id}`] = TestDirective;

    const dynamicMergedDirectives = {};
    dynamicMergedDirectives[`constraint_${componentA._id}`] = TestDirective;
    dynamicMergedDirectives[`authorization_${componentB._id}`] = TestDirective;

    t.deepEquals(componentB.directives, directives, 'has authorization directive in directives');
    t.deepEquals(componentB._importedDirectives, [importedDirectives], 'has constraint directive in imported directives');
    t.deepEquals(componentB._mergedDirectives, dynamicMergedDirectives, 'has constraint and authorization directives in merged directives');
  });

  t.test('componentB schema', async (t) => {
    t.plan(5);

    t.ok(componentB.schema._directives, 'has directives');

    const constraintDirective = componentB.schema._directives.filter((d) => {
      return d.name.startsWith("constraint");
    });

    t.ok(constraintDirective, 'has constraint directive in schema');
    t.equal(constraintDirective.length, 1, 'has constraint directive in schema');

    const authorizationDirective = componentB.schema._directives.filter((d) => {
      return d.name.startsWith("authorization");
    });
    t.ok(authorizationDirective, 'has authorization directive in schema');
    t.equal(authorizationDirective.length, 1, 'has authorization directive in schema');
  });

  t.test('componentB execute', async (t) => {
    t.plan(3);

    const query = `
      query {
        author(id: 1) {id, name, books}
      }
    `;

    const result = await componentB.execute(query);

    t.ok(result, 'has result');
    t.ok(result.data, 'data returned');
    t.error(result.errors, 'no errors');
  });
});

Test('test directives utilities', async (t) => {
  t.test('execute mergeDirectives', async (t) => {
    t.plan(1);
    const directives = [{constraint: TestDirective}, {authorization: TestDirective}];
    const merged = Directives.mergeDirectives(directives);

    t.deepEquals(merged, {constraint: TestDirective, authorization: TestDirective}, 'has constraint and authorization directives in merged directives');
  });

  t.test('execute getImportedDirectives', async (t) => {
    t.plan(1);
    const component = {
      _directives: {auth: TestDirective},
      _importedDirectives: [{constraint: TestDirective}, {authorization: TestDirective}]
    };
    const imported = Directives.getImportedDirectives(component);

    t.deepEquals(imported, {
      auth: TestDirective,
      constraint: TestDirective,
      authorization: TestDirective
    }, 'has auth, constraint and authorization directives in imported directives');
  });

  t.test('execute namespaceDirectivesInTypeDefs', async (t) => {
    t.plan(1);

    const constraintDirectiveWithNoSpaces = 'directive @constraint(schema: String!) on FIELD_DEFINITION';
    const authorizationDirectiveWithSpaces = 'directive @authorization  (schema: String!) on FIELD_DEFINITION';
    const restDirectiveNoArg = 'directive @rest on FIELD_DEFINITION';
    const otherTypes = `
      type Book {
        id: ID!
        title: String
      }
      type Query {
        book(id: ID!) : Book
      }
    `;

    const types = [
    `
      ${constraintDirectiveWithNoSpaces}
      ${otherTypes}
    `,
    `
      ${authorizationDirectiveWithSpaces}
      ${otherTypes}
    `,
      `
      ${restDirectiveNoArg}
      ${otherTypes}
    `
    ];
    const id = "cjld2cyuq0000t3rmniod1foy";
    const result = Directives.namespaceDirectivesInTypeDefs(types, id);

    const constraintDirectiveNamespaced = `directive @constraint_${id}(schema: String!) on FIELD_DEFINITION`;
    const authorizationDirectiveNamespaced = `directive @authorization_${id}  (schema: String!) on FIELD_DEFINITION`;
    const restDirectiveNamespaced = `directive @rest_${id} on FIELD_DEFINITION`;
    const typesNamespaced = [
      `
      ${constraintDirectiveNamespaced}
      ${otherTypes}
    `,
      `
      ${authorizationDirectiveNamespaced}
      ${otherTypes}
    `,
      `
      ${restDirectiveNamespaced}
      ${otherTypes}
    `
    ];

    t.deepEquals(result, typesNamespaced, 'has namespaced directives in type defs');
  });

  t.test('execute namespaceDirectiveDefs', async (t) => {
    t.plan(1);

    const directives = {
      constraint: TestDirective,
      authorization: TestDirective
    };

    const id = "cjld2cyuq0000t3rmniod1foy";
    const result = Directives.namespaceDirectiveDefs(directives, id);

    const directivesNamespaced = {};
    directivesNamespaced[`constraint_${id}`] = TestDirective;
    directivesNamespaced[`authorization_${id}`] = TestDirective;

    t.deepEquals(result, directivesNamespaced, 'has namespaced directives in result');
  });
});
