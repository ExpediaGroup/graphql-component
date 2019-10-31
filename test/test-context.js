'use strict';

const Test = require('tape');
const { createContext, wrapContext } = require('../lib/context');
const GraphQLComponent = require('../lib/index');

Test('context builder', async (t) => {
  t.plan(3);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        context: { namespace: 'import', factory: () => true}
      })
    ]
  });

  const context = createContext(component, { namespace: 'test', factory: () => true });

  const result = await context({});

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.test, 'namespace populated');
  t.ok(result.import, 'import namespace populated');
});

Test('context builder with namespace merge', async (t) => {
  t.plan(2);

  const component = new GraphQLComponent({
    imports: [
      new GraphQLComponent({
        context: { namespace: 'test', factory: () => ({ existing: true })}
      })
    ]
  });

  const context = createContext(component, { namespace: 'test', factory: () => ({ value: true }) });

  const result = await context({});

  t.ok(typeof result === 'object', 'returned object');  
  t.ok(result.test.existing && result.test.value, 'namespace merged');
});

Test('component context', async (t) => {
  t.plan(2);

  const context = wrapContext({
    _context() {},
    _dataSourceInjection() {}
  });

  const result = await context({ default1: true, default2: true });

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.default1 && result.default2, 'default values maintained');
});

Test('component context once', async (t) => {
  t.plan(3);

  const { context } = new GraphQLComponent({
    context: { namespace: 'parent', factory: (context) => { 
      t.equal(context.called, 1, 'import modified global context');
      context.called++;
      return Object.assign({}, context);
    }},
    imports: [
      new GraphQLComponent({
        context: { namespace: 'import', factory: (context) => {
          t.equal(context.called, 0, 'initial global context');
          context.called++;
          return Object.assign({}, context);
        }}
      })
    ]
  });

  const result = await context({ called: 0 });
  
  //The global context didn't reset because root wrapper context didn't get called again
  t.equal(result.called, 2, 'called root once'); 
});

Test('context middleware', async (t) => {
  t.plan(3);

  const context = wrapContext({
    _context() {},
    _dataSourceInjection() {}
  });

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

  const context = wrapContext({
    _context() {},
    _dataSourceInjection() {}
  });

  context.use(() => {
    return { test: true };
  });

  const result = await context({ default: true });

  t.ok(typeof result === 'object', 'returned object');
  t.ok(result.test, 'middleware populated');
  t.ok(!result.default, 'middleware mutated');
});