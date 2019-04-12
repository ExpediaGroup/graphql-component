'use strict';

const Test = require('tape');
const { buildASTSchema } = require('graphql');
const Gql = require('graphql-tag')
const Types = require('../lib/types');

Test('type utilities', (t) => {

  t.test('get types', (t) => {

    t.plan(2);

    const component = {
      _importedTypes: [],
      _types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    const types = Types.getImportedTypes(component);
    const schema = buildASTSchema(types[0]);


    t.ok(schema.getType('A').getFields().value, 'the "A" type exists');
    t.ok(schema.getQueryType().getFields().a, 'the "a" query exists');
  });

  t.test('get imported types', (t) => {

    t.plan(4);

    const component = {
      _importedTypes: [Gql`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      _types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    const types = Types.getImportedTypes(component);
    const schemaA = buildASTSchema(types[0]);
    t.ok(schemaA.getType('A').getFields().value, 'the "A" type exists');
    t.ok(schemaA.getQueryType().getFields().a, 'the "a" query exists');

    const schemaB = buildASTSchema(types[1])
    t.ok(schemaB.getType('B').getFields().value, 'the "B" type exists');
    t.ok(schemaB.getQueryType().getFields().b, 'the "b" query exists');
  });

  t.test('exclude', (t) => {

    t.plan(4);

    const component = {
      _importedTypes: [Gql`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      _types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    const types = Types.getImportedTypes(component, [['Query', 'b']]);
    const schemaA = buildASTSchema(types[0]);
    t.ok(schemaA.getType('A').getFields().value, 'the "A" type exists');
    t.ok(schemaA.getQueryType().getFields().a, 'the "a" query exists');

    const schemaB = buildASTSchema(types[1])
    t.ok(schemaB.getType('B').getFields().value, 'the "B" type exists');
    t.notOk(schemaB.getQueryType().getFields().b, 'the "b" query does not exist');
  });

  t.test('exclude caching', (t) => {

    t.plan(4);

    const component = {
      _importedTypes: [],
      _types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `]
    };

    let types = Types.getImportedTypes(component, [['Query', 'a']]);
    let schema = buildASTSchema(types[0]);
    t.ok(schema.getType('A').getFields().value, 'the "A" type exists');
    t.notOk(schema.getQueryType().getFields().a, 'the "a" query does not exist');

    types = Types.getImportedTypes(component);
    schema = buildASTSchema(types[0]);
    t.ok(schema.getType('A').getFields().value, 'the "A" type exists');
    t.ok(schema.getQueryType().getFields().a, 'the "a" query exists');
  });

  t.test('exclude all', (t) => {

    t.plan(2);

    const component = {
      _importedTypes: [],
      _types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
        type Mutation {
          a: A
        }
      `]
    };

    const types = Types.getImportedTypes(component, [['*']]);
    const schema = buildASTSchema(types[0]);
    t.notOk(schema.getQueryType().getFields().a, 'the "a" query does not exist');
    t.notOk(schema.getMutationType().getFields().a, 'the "a" mutation does not exist');
  });

});
