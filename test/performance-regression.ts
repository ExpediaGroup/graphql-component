import test from 'tape';
import GraphQLComponent from '../src/index';
import { graphql } from 'graphql';

test('Performance Optimization Regression Tests', (t) => {
  
  t.test('Data Source Proxy: Context Updates Correctly', async (assert) => {
    class TestDataSource {
      name = 'test';
      getData(context: any, id: string) {
        return `${context.requestId}-${id}`;
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test(id: String!): String }`,
      resolvers: {
        Query: {
          test(_, { id }, context) {
            return context.dataSources.test.getData(id);
          }
        }
      },
      dataSources: [new TestDataSource()]
    });

    // Multiple requests with different contexts should work correctly
    const context1 = await component.context({ requestId: 'req1' });
    const context2 = await component.context({ requestId: 'req2' });

    const result1 = context1.dataSources.test.getData('test1');
    const result2 = context2.dataSources.test.getData('test2');

    assert.equal(result1, 'req1-test1', 'first context works');
    assert.equal(result2, 'req2-test2', 'second context works');
    assert.notEqual(result1, result2, 'contexts are properly isolated');
    assert.end();
  });

  t.test('Data Source Proxy: Method Binding Preserved', async (assert) => {
    class TestDataSource {
      name = 'test';
      instanceValue = 'instance-data';
      
      getData(context: any) {
        return this.instanceValue; // 'this' should be bound correctly
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TestDataSource()]
    });

    const context = await component.context({});
    const result = context.dataSources.test.getData();

    assert.equal(result, 'instance-data', 'method binding preserved');
    assert.end();
  });

  t.test('Memoization: Complex Object Arguments', async (assert) => {
    let callCount = 0;
    
    const component = new GraphQLComponent({
      types: `
        type Query { 
          search(filter: SearchFilter): String 
        }
        input SearchFilter {
          name: String
          tags: [String]
          range: IntRange
        }
        input IntRange {
          min: Int
          max: Int
        }
      `,
      resolvers: {
        Query: {
          search(_, { filter }) {
            callCount++;
            return `Found: ${filter.name}`;
          }
        }
      }
    });

    const schema = component.schema;
    const query = `
      query($filter: SearchFilter) {
        search(filter: $filter)
      }
    `;

    const complexFilter = {
      name: "test",
      tags: ["tag1", "tag2"],
      range: { min: 1, max: 100 }
    };

    const context = { requestId: 'test' };
    
    // Same complex arguments should be memoized
    await graphql({ schema, source: query, variableValues: { filter: complexFilter }, contextValue: context });
    await graphql({ schema, source: query, variableValues: { filter: complexFilter }, contextValue: context });

    assert.equal(callCount, 1, 'complex object arguments are properly memoized');
    assert.end();
  });

  t.test('Memoization: Simple Argument Handling', async (assert) => {
    let calls: string[] = [];
    
    const component = new GraphQLComponent({
      types: `type Query { test(data: String): String }`,
      resolvers: {
        Query: {
          test(_, { data }) {
            calls.push(data);
            return `result-${data}`;
          }
        }
      }
    });

    const schema = component.schema;
    const context = { requestId: 'test' };

    // Test with simple distinct arguments
    const testCases = ['data1', 'data2', 'data3'];

    for (const testData of testCases) {
      await graphql({ 
        schema, 
        source: `{ test(data: "${testData}") }`, 
        contextValue: context 
      });
    }

    assert.equal(calls.length, testCases.length, 'each unique argument resulted in resolver call');
    assert.deepEqual(calls, testCases, 'all unique calls were made');
    assert.end();
  });

  t.test('Context Building: Parallel Import Processing', async (assert) => {
    let initOrder: string[] = [];
    
    class DelayedDataSource {
      constructor(public name: string, public delay: number) {}
      
      async init(context: any) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
        initOrder.push(this.name);
        return { initialized: true };
      }
    }

    const component1 = new GraphQLComponent({
      types: `type Query { test1: String }`,
      context: {
        namespace: 'comp1',
        factory: async () => {
          const ds = new DelayedDataSource('comp1', 50);
          await ds.init({});
          return { comp1Data: true };
        }
      }
    });

    const component2 = new GraphQLComponent({
      types: `type Query { test2: String }`,
      context: {
        namespace: 'comp2', 
        factory: async () => {
          const ds = new DelayedDataSource('comp2', 30);
          await ds.init({});
          return { comp2Data: true };
        }
      }
    });

    const component3 = new GraphQLComponent({
      types: `type Query { test3: String }`,
      context: {
        namespace: 'comp3',
        factory: async () => {
          const ds = new DelayedDataSource('comp3', 10);
          await ds.init({});
          return { comp3Data: true };
        }
      }
    });

    const mainComponent = new GraphQLComponent({
      types: `type Query { main: String }`,
      imports: [component1, component2, component3]
    });

    const startTime = Date.now();
    const context = await mainComponent.context({});
    const endTime = Date.now();

    // Should complete faster than sequential processing (90ms) due to parallelization
    const totalTime = endTime - startTime;
    assert.ok(totalTime < 80, `parallel processing faster than sequential: ${totalTime}ms < 80ms`);
    
    // All components should be initialized
    assert.ok(context.comp1?.comp1Data, 'component 1 context built');
    assert.ok(context.comp2?.comp2Data, 'component 2 context built');
    assert.ok(context.comp3?.comp3Data, 'component 3 context built');
    
    // Faster components should finish first (parallel execution)
    assert.equal(initOrder[0], 'comp3', 'fastest component finished first');
    assert.equal(initOrder[2], 'comp1', 'slowest component finished last');
    
    assert.end();
  });

  t.test('Context Building: Middleware Order Preserved', async (assert) => {
    const executionOrder: string[] = [];
    
    const component = new GraphQLComponent({
      types: `type Query { test: String }`
    });

    const contextFn = component.context;
    
    // Add middleware in specific order
    contextFn.use('first', async (ctx) => {
      executionOrder.push('first');
      return { ...ctx, value: 1 };
    });
    
    contextFn.use('second', async (ctx) => {
      executionOrder.push('second');
      return { ...ctx, value: (ctx.value as number) + 1 };
    });
    
    contextFn.use('third', async (ctx) => {
      executionOrder.push('third');
      return { ...ctx, value: (ctx.value as number) * 2 };
    });

    const result = await contextFn({});

    assert.deepEqual(executionOrder, ['first', 'second', 'third'], 'middleware executed in correct order');
    assert.equal(result.value, 4, 'middleware transformations applied correctly: (1 + 1) * 2 = 4');
    assert.end();
  });

  t.test('Context Building: Factory Execution', async (assert) => {
    let factoryCallCount = 0;
    
    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      context: {
        namespace: 'test',
        factory: async () => {
          factoryCallCount++;
          return { staticValue: 'cached' };
        }
      }
    });

    // Multiple context builds should not re-call factory for static parts
    const context1 = await component.context({ requestId: 'req1' });
    const context2 = await component.context({ requestId: 'req2' });

    assert.equal(context1.test.staticValue, 'cached', 'context 1 has correct value');
    assert.equal(context2.test.staticValue, 'cached', 'context 2 has correct value');
    assert.equal(factoryCallCount, 2, 'factory called for each dynamic context build');
    assert.end();
  });

  t.test('Integration: Basic Request Processing', async (assert) => {
    const component = new GraphQLComponent({
      types: `
        type Query { 
          hello(name: String!): String
        }
      `,
      resolvers: {
        Query: {
          hello(_, { name }) {
            return `Hello, ${name}!`;
          }
        }
      }
    });

    const schema = component.schema;
    const query = `{ hello(name: "World") }`;

    const result = await graphql({ schema, source: query, contextValue: {} });

    assert.ok(!result.errors, 'request completed without errors');
    const data = result.data as any;
    assert.equal(data?.hello, 'Hello, World!', 'request returned correct data');
    assert.end();
  });

  t.end();
}); 