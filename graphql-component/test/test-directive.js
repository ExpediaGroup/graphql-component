
const Test = require('tape');
const { MemoizeDirective } = require('../lib/directives');

Test('directives', (t) => {

  t.test('memoize directive creates memoized function on context', async (t) => {
    t.plan(2);

    const directive = new MemoizeDirective({ name: 'Test' });

    const field = {
      name: 'test',
      resolve() {}
    };

    directive.visitFieldDefinition(field);

    const context = {};

    field.resolve({}, {}, context, { parentType: 'Query' });

    t.ok(context.memoized && context.memoized.Query && context.memoized.Query.test, 'memoized structure on context');
    t.equal(typeof context.memoized.Query.test, 'function', 'is function');
  });

});