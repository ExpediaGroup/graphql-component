'use strict';

const Test = require('tape');
const { intercept, createDataSourceInjection } = require('./index');

Test('intercepts', (t) => {

  t.test('intercept proxy', (t) => {
    t.plan(4);

    const proxy = intercept(new class DataSource {
      constructor() {
        this.instanceField = 'some instance field value'
      }
      static get name() {
        return 'TestDataSource';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
        t.equal(this.instanceField, 'some instance field value', '`this` is correctly bound datasource instance methods')
      }
    }, {
      data: 'test'
    });

    proxy.test('test');
  });

  t.test('do not intercept proxy fields', (t) => {
    t.plan(1);

    const proxy = intercept(new class DataSource {
      constructor() {
        this.instanceField = 'some instance field value'
      }
      static get name() {
        return 'TestDataSource';
      }
    });

    t.equal(proxy.instanceField, 'some instance field value', 'field ok');
  });

});

Test('injection', (t) => {

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
      static get name() {
        return 'TestDataSourceInjection';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    }

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

  t.test('dataSource override', (t) => {
    t.plan(4);

    class DataSource {
      static get name() {
        return 'TestDataSourceInjection';
      }
      test(...args) {
        t.equal(args.length, 2, 'added additional arg');
        t.equal(args[0].data, 'test', 'injected the right data');
        t.equal(args[1], 'test', 'data still passed to original call');
      }
    }

    const component = {
      dataSources: [new class Default {
        static get name() {
          return 'TestDataSourceInjection';
        }
      }],
      imports: []
    };

    const injection = createDataSourceInjection(component, [new DataSource()]);

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
          component: {
            _dataSourceInjection: createDataSourceInjection({ imports: [] }),
            imports: []
          }
        }
      ]
    });

    t.doesNotThrow(() => {
      injection({});
    }, 'no exception thrown');
  });

});