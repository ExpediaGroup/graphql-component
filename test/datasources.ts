import test from 'tape';
import GraphQLComponent from '../src/index';

test('GraphQLComponent DataSource Tests', (t) => {
  t.test('should inject context into data source methods', async (assert) => {
    class TestDataSource {
      name = 'test';
      getData(context, arg) {
        return `${context.value}-${arg}`;
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TestDataSource()]
    });

    const context = await component.context({ value: 'test' });
    const result = context.dataSources.test.getData('arg');
    
    assert.equal(result, 'test-arg', 'context was injected into data source method');
    assert.end();
  });

  t.test('should allow data source overrides', async (assert) => {
    class TestDataSource {
      name = 'test';
      getData() {
        return 'original';
      }
    }

    class OverrideDataSource {
      name = 'test';
      getData() {
        return 'override';
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TestDataSource()],
      dataSourceOverrides: [new OverrideDataSource()]
    });

    const context = await component.context({});
    const result = context.dataSources.test.getData();
    
    assert.equal(result, 'override', 'data source was overridden');
    assert.end();
  });

  t.end();
}); 