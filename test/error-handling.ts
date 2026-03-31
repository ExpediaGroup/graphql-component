import test from 'tape';
import GraphQLComponent from '../src/index';

test('Error Handling Tests', (t) => {

  t.test('schema creation error preserves cause', (assert) => {
    const component = new GraphQLComponent({
      types: 'invalid schema definition %%%',
    });

    try {
      component.schema;
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error, 'throws an Error');
      assert.ok(err.message.includes('Failed to create schema'), 'has descriptive message');
      assert.ok(err.cause, 'preserves original error as cause');
      assert.end();
    }
  });

  t.test('null mocks should not throw validation error', (assert) => {
    assert.doesNotThrow(() => {
      new GraphQLComponent({
        types: 'type Query { hello: String }',
        mocks: null
      });
    }, 'null mocks are accepted');
    assert.end();
  });

  t.test('context.namespace must be a non-empty string', (assert) => {
    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { hello: String }',
        context: { namespace: '', factory: () => ({}) }
      }),
      /context\.namespace must be a non-empty string/,
      'empty namespace throws'
    );
    assert.end();
  });

  t.test('context.factory must be a function', (assert) => {
    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { hello: String }',
        context: { namespace: 'test', factory: 'not a function' as any }
      }),
      /context\.factory must be a function/,
      'non-function factory throws'
    );
    assert.end();
  });

  t.test('transforms must be an array', (assert) => {
    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { hello: String }',
        transforms: {} as any
      }),
      /transforms must be an array/,
      'non-array transforms throws'
    );
    assert.end();
  });

  t.test('middleware use() without function throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    assert.throws(
      () => component.context.use('test'),
      /Middleware "test" requires a function argument/,
      'use() without function throws'
    );
    assert.end();
  });

  t.test('middleware use() returns unsubscribe function', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    const unsubscribe = component.context.use('test', (ctx) => ctx);
    assert.equal(typeof unsubscribe, 'function', 'use() returns a function');
    assert.end();
  });

  t.end();
});
