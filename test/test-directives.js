'use strict';

const Test = require('tape');
const {SchemaDirectiveVisitor} = require('graphql-tools');

const GraphQLComponent = require('../lib/index');
const Directives = require('../lib/directives');

class TestDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {}
  visitEnumValue(field) {}
}

const componentA = new GraphQLComponent({
  types: [`
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
  directives: {deprecated: TestDirective}
});

Test('test componentA', async (t) => {
  t.test('componentA construct', async (t) => {
    t.plan(3);

    t.deepEquals(componentA.directives, {constraint: TestDirective}, 'has constraint directive in directives');
    t.deepEquals(componentA._importedDirectives, [], 'imported directives are empty');
    t.deepEquals(componentA.mergedDirectives, {constraint: TestDirective}, 'has constraint directive in merged directives');
  });

  t.test('componentA schema', async (t) => {
    t.plan(2);

    t.ok(componentA.schema._directives, 'has directives');

    const TestDirective = componentA.schema._directives.filter((d) => {
      return d.name === "constraint";
    });
    t.ok(TestDirective, 'has constraint directive in schema');
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

    t.deepEquals(componentB.directives, {deprecated: TestDirective}, 'has deprecated directive in directives');
    t.deepEquals(componentB._importedDirectives, [{constraint: TestDirective}], 'has constraint directive in imported directives');
    t.deepEquals(componentB.mergedDirectives, {constraint: TestDirective, deprecated: TestDirective}, 'has constraint and deprecated directives in merged directives');
  });

  t.test('componentB schema', async (t) => {
    t.plan(3);

    t.ok(componentB.schema._directives, 'has directives');

    const constraintDirective = componentB.schema._directives.filter((d) => {
      return d.name === "constraint";
    });
    t.ok(constraintDirective, 'has constraint directive in schema');

    const deprecatedDirective = componentB.schema._directives.filter((d) => {
      return d.name === "deprecated";
    });
    t.ok(deprecatedDirective, 'has deprecated directive in schema');
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
    const directives = [{constraint: TestDirective}, {deprecated: TestDirective}];
    const merged = Directives.mergeDirectives(directives);

    t.deepEquals(merged, {constraint: TestDirective, deprecated: TestDirective}, 'has constraint and deprecated directives in merged directives');
  });

  t.test('execute getImportedDirectives', async (t) => {
    t.plan(1);
    const component = {
      _directives: {auth: TestDirective},
      _importedDirectives: [{constraint: TestDirective}, {deprecated: TestDirective}]
    };
    const imported = Directives.getImportedDirectives(component);

    t.deepEquals(imported, {
      auth: TestDirective,
      constraint: TestDirective,
      deprecated: TestDirective
    }, 'has auth, constraint and deprecated directives in imported directives');
  });
});
