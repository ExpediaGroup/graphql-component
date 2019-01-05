
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

    const cache = new WeakMap();

    cache.set(field.resolve, true);

    t.ok(cache.has(field.resolve), 'resolve unchanged.');

    directive.visitFieldDefinition(field);

    t.ok(!cache.has(field.resolve), 'resolve change.');
  });

});