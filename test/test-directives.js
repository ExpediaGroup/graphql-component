'use strict';

const Test = require('tape');

const GraphQLComponent = require('../lib/index');
const Directives = require('../lib/directives');

Test('test component', (t) => {
  t.test('component construct', async (t) => {
    t.plan(6);

    const componentA = new GraphQLComponent({
      types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `],
      directives: {constraint: 'constraint-directive'}
    });
    t.deepEquals(componentA.directives, {constraint: 'constraint-directive'});
    t.deepEquals(componentA.importedDirectives, []);
    t.deepEquals(componentA.mergedDirectives, {constraint: 'constraint-directive'});

    const componentB = new GraphQLComponent({
      types: [`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      imports: [
        componentA
      ],
      directives: {deprecated: 'deprecated-directive'}
    });
    t.deepEquals(componentB.directives, {deprecated: 'deprecated-directive'});
    t.deepEquals(componentB.importedDirectives, [{constraint: 'constraint-directive'}]);
    t.deepEquals(componentB.mergedDirectives, {constraint: 'constraint-directive', deprecated: 'deprecated-directive'});
  });
});

Test('test directives utilities', (t) => {
  t.test('execute mergeDirectives', async (t) => {
    t.plan(1);
    const directives = [{constraint: 'constraint-directive'}, {deprecated: 'deprecated-directive'}];

    const merged = Directives.mergeDirectives(directives);

    t.deepEquals(merged, {
      constraint: 'constraint-directive',
      deprecated: 'deprecated-directive'
    });
  });

  t.test('execute getImportedDirectives', async (t) => {
    t.plan(1);
    const component = {
      _directives: {auth: 'auth-directive'},
      _importedDirectives: [{constraint: 'constraint-directive'}, {deprecated: 'deprecated-directive'}]};

    const imported = Directives.getImportedDirectives(component);

    t.deepEquals(imported, {
      auth: 'auth-directive',
      constraint: 'constraint-directive',
      deprecated: 'deprecated-directive'
    });
  });
});
