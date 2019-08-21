'use strict';

const Test = require('tape');
const { intercept, createProviderInjection } = require('../lib/provider');
const GraphQLComponent = require('../lib/index');

Test('provider', (t) => {

  t.test('intercept proxy', (t) => {
    t.plan(3);

    const proxy = intercept(new class Provider {
      get name() {
        return 'TestProvider';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    }, {
      data: 'test'
    });

    proxy.test('test');
  });

  t.test('provider injection function empty', (t) => {
    t.plan(1);

    const injection = createProviderInjection({
      imports: []
    });

    t.doesNotThrow(() => {
      injection();
    }, 'no exception thrown');
  });

  t.test('provider injection function', (t) => {
    t.plan(4);

    class Provider {
      get name() {
        return 'TestProvider';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    };

    const component = {
      provider: new Provider(),
      imports: []
    };

    const injection = createProviderInjection(component);

    const globalContext = { data: 'test' };
    
    injection(globalContext);

    t.ok(globalContext.providers && globalContext.providers.TestProvider, 'provider added to context');
    
    globalContext.providers.TestProvider.test('test');
  });

  t.test('provider injection function imports', (t) => {
    t.plan(1);

    const injection = createProviderInjection({
      imports: [
        {
          _providerInjection: createProviderInjection({ imports: [] }),
          imports: []
        }
      ]
    });

    t.doesNotThrow(() => {
      injection({});
    }, 'no exception thrown');
  });

  t.test('component and context injection', async (t) => {
    t.plan(4);

    class Provider {
      get name() {
        return 'TestProvider';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    };

    const { context } = new GraphQLComponent({
      provider: new Provider()
    });

    const globalContext = await context({ data: 'test' });

    t.ok(globalContext.providers && globalContext.providers.TestProvider, 'provider added to context');
    
    globalContext.providers.TestProvider.test('test');
  });

});