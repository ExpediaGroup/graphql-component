'use strict';

const Test = require('tape');
const { intercept, createDataSourceInjection } = require('../lib/datasource');
const GraphQLComponent = require('../lib/index');

Test('dataSource', (t) => {

  t.test('intercept proxy', (t) => {
    t.plan(3);

    const proxy = intercept(new class DataSource {
      get name() {
        return 'TestDataSource';
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

  t.test('dataSource injection function empty', (t) => {
    t.plan(1);

    const injection = createDataSourceInjection({
      imports: []
    });

    t.doesNotThrow(() => {
      injection();
    }, 'no exception thrown');
  });

  t.test('dataSource injection function', (t) => {
    t.plan(4);

    class DataSource {
      get name() {
        return 'TestDataSourceInjection';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    };

    const component = {
      dataSources: [new DataSource()],
      imports: []
    };

    const injection = createDataSourceInjection(component);

    const globalContext = { data: 'test' };
    
    globalContext.dataSources = injection(globalContext);

    t.ok(globalContext.dataSources && globalContext.dataSources.TestDataSourceInjection, 'dataSource added to context');
    
    globalContext.dataSources.TestDataSourceInjection.test('test');
  });

  t.test('dataSource injection function imports', (t) => {
    t.plan(1);

    const injection = createDataSourceInjection({
      imports: [
        {
          _dataSourceInjection: createDataSourceInjection({ imports: [] }),
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

    class DataSource {
      get name() {
        return 'TestDataSource';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    };

    const { context } = new GraphQLComponent({
      dataSources: [new DataSource()]
    });

    const globalContext = await context({ data: 'test' });

    t.ok(globalContext.dataSources && globalContext.dataSources.TestDataSource, 'dataSource added to context');
    
    globalContext.dataSources.TestDataSource.test('test');
  });

  t.test('dataSource without name fails', async (t) => {
    t.plan(1);

    t.throws(() => {
      new GraphQLComponent({
        dataSources: [new class DataSource {}]
      });
    });
  });

});