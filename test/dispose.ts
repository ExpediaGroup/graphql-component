import test from 'tape';
import GraphQLComponent from '../src/index';

test('GraphQLComponent dispose() Tests', (t) => {

  t.test('disposed returns false before dispose', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    assert.equal(component.disposed, false, 'not disposed initially');
    assert.end();
  });

  t.test('disposed returns true after dispose', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();
    assert.equal(component.disposed, true, 'disposed after calling dispose()');
    assert.end();
  });

  t.test('accessing schema after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }',
      resolvers: { Query: { hello: () => 'world' } }
    });

    // Access schema before dispose to ensure it works
    assert.ok(component.schema, 'schema accessible before dispose');

    component.dispose();

    assert.throws(
      () => component.schema,
      /has been disposed/,
      'accessing schema after dispose throws'
    );
    assert.end();
  });

  t.test('accessing context after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();

    assert.throws(
      () => component.context,
      /has been disposed/,
      'accessing context after dispose throws'
    );
    assert.end();
  });

  t.test('accessing types after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();

    assert.throws(
      () => component.types,
      /has been disposed/,
      'accessing types after dispose throws'
    );
    assert.end();
  });

  t.test('accessing resolvers after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();

    assert.throws(
      () => component.resolvers,
      /has been disposed/,
      'accessing resolvers after dispose throws'
    );
    assert.end();
  });

  t.test('accessing imports after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();

    assert.throws(
      () => component.imports,
      /has been disposed/,
      'accessing imports after dispose throws'
    );
    assert.end();
  });

  t.test('accessing dataSources after dispose throws', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();

    assert.throws(
      () => component.dataSources,
      /has been disposed/,
      'accessing dataSources after dispose throws'
    );
    assert.end();
  });

  t.test('calling dispose twice does not throw', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { hello: String }'
    });

    component.dispose();
    assert.doesNotThrow(() => component.dispose(), 'second dispose does not throw');
    assert.end();
  });

  t.end();
});
