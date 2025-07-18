import test from 'tape';
import GraphQLComponent from '../src/index';

test('Async Import Context Building Tests', (t) => {
  
  t.test('should merge data sources from imported components', async (assert) => {
    class ParentDataSource {
      name = 'parent';
      getParentData(context: any, id: string) {
        return `parent-${id}`;
      }
    }
    
    class ChildDataSource {
      name = 'child';
      getChildData(context: any, id: string) {
        return `child-${id}`;
      }
    }
    
    const childComponent = new GraphQLComponent({
      types: `type Query { childQuery: String }`,
      dataSources: [new ChildDataSource()]
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parentQuery: String }`,
      dataSources: [new ParentDataSource()],
      imports: [childComponent]
    });
    
    const context = await parentComponent.context({ requestId: 'test' });
    
    // Both data sources should be available
    assert.ok(context.dataSources.parent, 'parent data source available');
    assert.ok(context.dataSources.child, 'child data source available');
    
    // Both should work with context injection
    const parentResult = context.dataSources.parent.getParentData('123');
    const childResult = context.dataSources.child.getChildData('456');
    
    assert.equal(parentResult, 'parent-123', 'parent data source works');
    assert.equal(childResult, 'child-456', 'child data source works');
    assert.end();
  });
  
  t.test('should handle async context factories in imports', async (assert) => {
    const childComponent = new GraphQLComponent({
      types: `type Query { child: String }`,
      context: {
        namespace: 'child',
        factory: async (globalContext) => {
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 10));
          return { 
            asyncData: 'child-async',
            globalValue: globalContext.test
          };
        }
      }
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      context: {
        namespace: 'parent',
        factory: async (globalContext) => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return { 
            asyncData: 'parent-async',
            globalValue: globalContext.test
          };
        }
      },
      imports: [childComponent]
    });
    
    const context = await parentComponent.context({ test: 'global-value' });
    
    assert.equal(context.child.asyncData, 'child-async', 'child async context built');
    assert.equal(context.parent.asyncData, 'parent-async', 'parent async context built');
    assert.equal(context.child.globalValue, 'global-value', 'child received global context');
    assert.equal(context.parent.globalValue, 'global-value', 'parent received global context');
    assert.end();
  });
  
  t.test('should handle deep import chains', async (assert) => {
    // Create a chain: grandparent -> parent -> child
    const childComponent = new GraphQLComponent({
      types: `type Query { child: String }`,
      context: {
        namespace: 'child',
        factory: async () => ({ level: 'child' })
      }
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      context: {
        namespace: 'parent',
        factory: async () => ({ level: 'parent' })
      },
      imports: [childComponent]
    });
    
    const grandparentComponent = new GraphQLComponent({
      types: `type Query { grandparent: String }`,
      context: {
        namespace: 'grandparent',
        factory: async () => ({ level: 'grandparent' })
      },
      imports: [parentComponent]
    });
    
    const context = await grandparentComponent.context({});
    
    // All levels should be present
    assert.equal(context.child.level, 'child', 'child context built');
    assert.equal(context.parent.level, 'parent', 'parent context built');
    assert.equal(context.grandparent.level, 'grandparent', 'grandparent context built');
    assert.end();
  });
  
  t.test('should handle context factory errors gracefully', async (assert) => {
    const failingComponent = new GraphQLComponent({
      types: `type Query { failing: String }`,
      context: {
        namespace: 'failing',
        factory: async () => {
          throw new Error('Context factory failed');
        }
      }
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      imports: [failingComponent]
    });
    
    try {
      await parentComponent.context({});
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error.message.includes('Context factory failed'), 'error propagated correctly');
    }
    assert.end();
  });
  
  t.test('should handle multiple imports with same data source names', async (assert) => {
    class TestDataSource {
      constructor(public suffix: string) {}
      name = 'test';
      getData(context: any, id: string) {
        return `${this.suffix}-${id}`;
      }
    }
    
    const component1 = new GraphQLComponent({
      types: `type Query { comp1: String }`,
      dataSources: [new TestDataSource('comp1')]
    });
    
    const component2 = new GraphQLComponent({
      types: `type Query { comp2: String }`,
      dataSources: [new TestDataSource('comp2')]
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      imports: [component1, component2] // Both have 'test' data source
    });
    
    const context = await parentComponent.context({});
    
    // Last one should win (component2)
    const result = context.dataSources.test.getData('123');
    assert.equal(result, 'comp2-123', 'last imported data source wins in case of name collision');
    assert.end();
  });
  
  t.test('should process imports in parallel and maintain correct timing', async (assert) => {
    const timings: { component: string; start: number; end: number }[] = [];
    
    const createDelayedComponent = (name: string, delay: number) => {
      return new GraphQLComponent({
        types: `type Query { ${name}: String }`,
        context: {
          namespace: name,
          factory: async () => {
            const start = Date.now();
            timings.push({ component: name, start, end: 0 });
            await new Promise(resolve => setTimeout(resolve, delay));
            const end = Date.now();
            timings[timings.length - 1].end = end;
            return { processed: true };
          }
        }
      });
    };
    
    const comp1 = createDelayedComponent('comp1', 30);
    const comp2 = createDelayedComponent('comp2', 20);
    const comp3 = createDelayedComponent('comp3', 10);
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      imports: [comp1, comp2, comp3]
    });
    
    const overallStart = Date.now();
    const context = await parentComponent.context({});
    const overallEnd = Date.now();
    
    // All contexts should be built
    assert.ok(context.comp1.processed, 'comp1 processed');
    assert.ok(context.comp2.processed, 'comp2 processed');
    assert.ok(context.comp3.processed, 'comp3 processed');
    
    // Should complete faster than sequential (60ms total) due to parallelization
    const totalTime = overallEnd - overallStart;
    assert.ok(totalTime < 50, `parallel processing completed in ${totalTime}ms (expected < 50ms)`);
    
    // All imports should start around the same time (within 5ms)
    const startTimes = timings.map(t => t.start);
    const maxStartDiff = Math.max(...startTimes) - Math.min(...startTimes);
    assert.ok(maxStartDiff < 5, `imports started concurrently (max diff: ${maxStartDiff}ms)`);
    
    assert.end();
  });
  
  t.test('should handle imports with both data sources and context namespaces', async (assert) => {
    class SharedDataSource {
      name = 'shared';
      getData(context: any, id: string) {
        return `shared-${context.namespace || 'unknown'}-${id}`;
      }
    }
    
    const component1 = new GraphQLComponent({
      types: `type Query { comp1: String }`,
      context: {
        namespace: 'comp1',
        factory: async () => ({ namespace: 'comp1' })
      },
      dataSources: [new SharedDataSource()]
    });
    
    const component2 = new GraphQLComponent({
      types: `type Query { comp2: String }`,
      context: {
        namespace: 'comp2',
        factory: async () => ({ namespace: 'comp2' })
      }
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      imports: [component1, component2]
    });
    
    const context = await parentComponent.context({});
    
    // Both namespaces should be present
    assert.equal(context.comp1.namespace, 'comp1', 'comp1 namespace context');
    assert.equal(context.comp2.namespace, 'comp2', 'comp2 namespace context');
    
    // Data source should be available
    assert.ok(context.dataSources.shared, 'shared data source available');
    
    assert.end();
  });
  
  t.test('should preserve data source method binding across async operations', async (assert) => {
    class InstanceDataSource {
      name = 'instance';
      private instanceData = 'bound-correctly';
      
      async getData(context: any, id: string) {
        // Simulate async work to test binding preservation
        await new Promise(resolve => setTimeout(resolve, 1));
        return `${this.instanceData}-${id}`;
      }
    }
    
    const childComponent = new GraphQLComponent({
      types: `type Query { child: String }`,
      dataSources: [new InstanceDataSource()]
    });
    
    const parentComponent = new GraphQLComponent({
      types: `type Query { parent: String }`,
      imports: [childComponent]
    });
    
    const context = await parentComponent.context({});
    
    // Method binding should be preserved even after async import processing
    const result = await context.dataSources.instance.getData('test');
    assert.equal(result, 'bound-correctly-test', 'method binding preserved across async operations');
    assert.end();
  });

  t.end();
}); 