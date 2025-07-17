import test from 'tape';
import GraphQLComponent from '../src/index';

test('GraphQLComponent Configuration Validation', (t) => {
  t.test('should throw error when federation enabled without types', (assert) => {
    assert.throws(
      () => new GraphQLComponent({ federation: true }),
      /Federation requires type definitions/,
      'throws error when federation enabled without types'
    );
    assert.end();
  });

  t.test('should throw error for invalid mocks configuration', (assert) => {
    assert.throws(
      () => new GraphQLComponent({ types: ['type Query { test: String }'], mocks: 'invalid' as any }),
      /mocks must be either boolean or object/,
      'throws error for invalid mocks value'
    );
    assert.end();
  });

  t.end();
}); 