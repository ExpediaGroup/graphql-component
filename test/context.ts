import test from 'tape';
import GraphQLComponent from '../src/index';

test('GraphQLComponent Context Tests', (t) => {
  t.test('should build context with middleware', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`
    });

    const contextFn = component.context;
    contextFn.use('test', async (ctx) => ({
      ...ctx,
      testValue: 'test'
    }));

    const context = await contextFn({});
    assert.equal(context.testValue, 'test', 'middleware was applied');
    assert.end();
  });

  t.test('should handle multiple middleware in order', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`
    });

    const contextFn = component.context;
    contextFn.use('first', async (ctx) => ({
      ...ctx,
      value: 1
    }));
    contextFn.use('second', async (ctx) => ({
      ...ctx,
      value: (ctx.value as number) + 1
    }));

    const context = await contextFn({});
    assert.equal(context.value, 2, 'middleware executed in order');
    assert.end();
  });

  t.end();
}); 