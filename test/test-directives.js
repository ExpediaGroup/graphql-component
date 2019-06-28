'use strict';

const Test = require('tape');
const Directives = require('../lib/directives');

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
