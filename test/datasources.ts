import test from 'tape';
import GraphQLComponent, { DataSourceDefinition, DataSource, ComponentContext } from '../src/index';
import { IResolvers } from '@graphql-tools/utils';
import { GraphQLResolveInfo } from 'graphql';

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

  t.test('should preserve non-function properties', async (assert) => {
    class TestDataSource {
      name = 'test';
      staticValue = 'static value';
      getData(context) {
        return this.staticValue;
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TestDataSource()]
    });

    const context = await component.context({});
    
    assert.equal(context.dataSources.test.staticValue, 'static value', 'static property was preserved');
    assert.equal(context.dataSources.test.getData(), 'static value', 'method can access static property');
    assert.end();
  });

  t.test('should verify DataSourceDefinition type at compile time', async (assert) => {
    // This test doesn't run any assertions, it's just to verify the types compile

    // Explicit typing with DataSourceDefinition to demonstrate proper usage
    class TypedDataSource implements DataSourceDefinition<{
      getData: (context: ComponentContext, id: string) => { id: string, extra: string };
      getMultiple: (context: ComponentContext, ids: string[]) => { id: string }[];
      staticProp: string;
    }> {
      name = 'typed';
      staticProp = 'static value';
      
      getData(context: ComponentContext, id: string) {
        return { id, extra: context.value as string };
      }
      
      getMultiple(context: ComponentContext, ids: string[]) {
        return ids.map(id => ({ id }));
      }
    }

    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      dataSources: [new TypedDataSource()]
    });

    const context = await component.context({ value: 'test-value' });
    
    // Using DataSource type demonstrates automatic context injection
    const typedDS = context.dataSources.typed as DataSource<TypedDataSource>;
    
    const result1 = typedDS.getData('123');
    const result2 = typedDS.getMultiple(['1', '2', '3']);
    
    assert.equal(result1.id, '123', 'typed data source returns correct id');
    assert.equal(result1.extra, 'test-value', 'typed data source includes context value');
    assert.equal(result2.length, 3, 'typed data source handles multiple ids');
    assert.equal(typedDS.staticProp, 'static value', 'static property preserved in typed data source');
    assert.end();
  });

  t.test('should verify DataSource type in resolvers', async (assert) => {
    // Define data source with required context parameter
    class UserDataSource implements DataSourceDefinition<{
      getUserById: (context: ComponentContext, id: string) => { id: string, name: string };
      getUsersByRole: (context: ComponentContext, role: string) => { id: string, name: string }[];
    }> {
      name = 'users';
      
      getUserById(context: ComponentContext, id: string) {
        // Implementation requires context
        return { id, name: `User ${id}` };
      }
      
      getUsersByRole(context: ComponentContext, role: string) {
        // Implementation requires context
        return [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' }
        ];
      }
    }

    // Define resolvers with explicit Query type
    const resolvers = {
      Query: {
        // In resolvers, we don't need to pass context to data source methods
        user: (_: any, { id }: { id: string }, context: ComponentContext, info: GraphQLResolveInfo) => {
          // Context is injected automatically - call without passing context
          return context.dataSources.users.getUserById(id);
        },
        usersByRole: (_: any, { role }: { role: string }, context: ComponentContext, info: GraphQLResolveInfo) => {
          // Context is injected automatically - call without passing context
          return context.dataSources.users.getUsersByRole(role);
        }
      }
    };

    const component = new GraphQLComponent({
      types: `
        type User {
          id: ID!
          name: String!
        }
        type Query {
          user(id: ID!): User
          usersByRole(role: String!): [User]
        }
      `,
      resolvers,
      dataSources: [new UserDataSource()]
    });

    const context = await component.context({});
    
    // Test resolver behavior with null info parameter
    const user = await resolvers.Query.user(null, { id: '123' }, context, null as any);
    const users = await resolvers.Query.usersByRole(null, { role: 'admin' }, context, null as any);
    
    assert.equal(user.id, '123', 'resolver correctly called data source');
    assert.equal(user.name, 'User 123', 'data source returned correct user name');
    assert.equal(users.length, 2, 'resolver correctly called multi-user data source');
    assert.end();
  });

  t.end();
}); 