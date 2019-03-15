
const Test = require('tape');
const Context = require('../lib/context');
const GraphQLComponent = require('../lib/index');

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

Test('component context', async (t) => {
  t.plan(2);

  const context = Context.create(() => {});

  const result = await context({ default1: true, default2: true });

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.default1 && result.default2, 'default values maintained');
});

Test('context middleware', async (t) => {
  t.plan(3);

  const context = Context.create(() => {});

  context.use('test', () => {
    return { test: true };
  });

  const result = await context({ default: true });

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.test, 'middleware populated');
  t.ok(!result.default, 'middleware mutated');
});

Test('unnamed context middleware', async (t) => {
  t.plan(3);

  const context = Context.create(() => {});

  context.use(() => {
    return { test: true };
  });

  const result = await context({ default: true });

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.test, 'middleware populated');
  t.ok(!result.default, 'middleware mutated');
});