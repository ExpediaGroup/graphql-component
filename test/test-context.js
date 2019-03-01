
const Test = require('tape');
const Context = require('../lib/context');

Test('context builder', async (t) => {
  t.plan(3);

  const component = {
    _imports: [
      {
        _context: Context.builder({ _imports: [] }, { namespace: 'import', factory: () => true})
      }
    ]
  };

  const context = Context.builder(component, { namespace: 'test', factory: () => true });

  const result = await context();

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.test, 'namespace populated');
  t.ok(result.import, 'import namespace populated');
});