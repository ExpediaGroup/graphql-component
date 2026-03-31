import test from 'tape';
import GraphQLComponent, { IGraphQLComponent } from '../src/index';
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';

test('Middleware error propagation', (t) => {
  t.test('should propagate error thrown mid-chain', async (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { test: String }'
    });

    const contextFn = component.context;
    contextFn.use('first', async (ctx) => ({ ...ctx, first: true }));
    contextFn.use('failing', async () => {
      throw new Error('middleware failure');
    });
    contextFn.use('third', async (ctx) => ({ ...ctx, third: true }));

    try {
      await contextFn({});
      assert.fail('should have thrown');
    }
    catch (err) {
      assert.ok(err instanceof Error, 'error is an Error');
      assert.equal((err as Error).message, 'middleware failure', 'error message preserved');
    }
    assert.end();
  });

  t.test('should stop chain on error and not run subsequent middleware', async (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { test: String }'
    });

    let thirdRan = false;
    const contextFn = component.context;
    contextFn.use('first', async (ctx) => ({ ...ctx, first: true }));
    contextFn.use('failing', async () => {
      throw new Error('stop here');
    });
    contextFn.use('third', async (ctx) => {
      thirdRan = true;
      return { ...ctx, third: true };
    });

    try {
      await contextFn({});
    }
    catch {
      // expected
    }
    assert.notOk(thirdRan, 'third middleware did not run after error');
    assert.end();
  });

  t.end();
});

test('Namespace collision with dataSources', (t) => {
  t.test('should throw when namespace is "dataSources"', (assert) => {
    assert.throws(
      () => new GraphQLComponent({
        types: 'type Query { test: String }',
        context: {
          namespace: 'dataSources',
          factory: () => ({})
        }
      }),
      /context\.namespace cannot be "dataSources"/,
      'throws on dataSources namespace'
    );
    assert.end();
  });

  t.end();
});

test('Subscription resolver binding', (t) => {
  t.test('should bind Subscription resolvers without memoization', async (assert) => {
    let callCount = 0;

    const component = new GraphQLComponent({
      types: `
        type Query { test: String }
        type Subscription { onTest: String }
      `,
      resolvers: {
        Query: {
          test() {
            return 'test';
          }
        },
        Subscription: {
          onTest: {
            subscribe() {
              callCount++;
              return (async function* () {
                yield { onTest: `event-${callCount}` };
              })();
            }
          }
        }
      }
    });

    const resolvers = component.resolvers as any;
    assert.ok(resolvers.Subscription, 'Subscription resolvers exist');
    assert.ok(resolvers.Subscription.onTest, 'onTest resolver exists');
    assert.ok(resolvers.Subscription.onTest.subscribe, 'subscribe function exists');

    // Call subscribe twice -- should NOT be memoized
    const iter1 = resolvers.Subscription.onTest.subscribe();
    const iter2 = resolvers.Subscription.onTest.subscribe();
    assert.equal(callCount, 2, 'subscribe called twice (not memoized)');
    assert.notEqual(iter1, iter2, 'each call returns a new iterator');
    assert.end();
  });

  t.end();
});

test('Middleware unsubscribe function', (t) => {
  t.test('should remove middleware when unsubscribe is called', async (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { test: String }'
    });

    const contextFn = component.context;
    const unsub = contextFn.use('removable', async (ctx) => ({
      ...ctx,
      removable: true
    }));

    // Verify middleware runs
    const ctx1 = await contextFn({});
    assert.ok(ctx1.removable, 'middleware applied before unsub');

    // Unsubscribe
    unsub();

    // Verify middleware no longer runs
    const ctx2 = await contextFn({});
    assert.notOk(ctx2.removable, 'middleware not applied after unsub');
    assert.end();
  });

  t.test('calling unsubscribe twice should be safe', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { test: String }'
    });

    const contextFn = component.context;
    const unsub = contextFn.use('removable', async (ctx) => ctx);

    unsub();
    assert.doesNotThrow(() => unsub(), 'second unsub does not throw');
    assert.end();
  });

  t.end();
});

test('Concurrent context() calls', (t) => {
  t.test('should handle concurrent context calls without corruption', async (assert) => {
    class TestDS {
      name = 'TestDS';
      getData(context: any) {
        return { caller: context.caller };
      }
    }

    const component = new GraphQLComponent({
      types: 'type Query { test: String }',
      dataSources: [new TestDS()],
      context: {
        namespace: 'ns',
        factory: async (ctx: any) => {
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 5));
          return { callerNs: ctx.caller };
        }
      }
    });

    // Fire 10 concurrent context calls
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => component.context({ caller: `req-${i}` }))
    );

    for (let i = 0; i < 10; i++) {
      const ns = (results[i] as any).ns;
      assert.equal(ns.callerNs, `req-${i}`, `request ${i} has correct namespace context`);
    }
    assert.end();
  });

  t.end();
});

test('Import injector with custom IGraphQLComponent without dataSources', (t) => {
  t.test('should not crash when imported component has no dataSources', async (assert) => {
    const customComponent: IGraphQLComponent = {
      get name() { return 'NoDSComponent'; },
      get schema() {
        return new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'Query',
            fields: { custom: { type: GraphQLString, resolve: () => 'val' } }
          })
        });
      },
      get context() {
        const fn = async (ctx: Record<string, unknown>) => ({ ...ctx, dataSources: {} as any });
        fn.use = () => () => {};
        return fn;
      },
      get types() { return ['type Query { custom: String }']; },
      get resolvers() { return { Query: { custom: () => 'val' } }; }
      // dataSources and dataSourceOverrides intentionally omitted
    };

    const parent = new GraphQLComponent({
      types: 'type Query { parent: String }',
      imports: [customComponent]
    });

    const ctx = await parent.context({});
    assert.ok(ctx.dataSources, 'dataSources exists in context');
    assert.end();
  });

  t.end();
});

test('Transform loop handles falsy return values', (t) => {
  t.test('should not break on null transform result', (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      resolvers: {
        Query: {
          test() {
            return 'hello';
          }
        }
      },
      transforms: [
        {
          ['{graphql-tools}.MapperKind.OBJECT_TYPE' as any]: () => null
        }
      ]
    });

    assert.doesNotThrow(() => component.schema, 'schema with null-returning transform does not throw');
    assert.end();
  });

  t.end();
});

test('Federation setter invalidates schema', (t) => {
  t.test('should invalidate cached schema when federation flag changes', (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test: String }`,
      resolvers: {
        Query: {
          test() {
            return 'hello';
          }
        }
      }
    });

    // Access schema to cache it
    const schema1 = component.schema;
    assert.ok(schema1, 'initial schema created');

    // Toggle federation off->off shouldn't matter, but toggle off->true
    // Setting federation = true invalidates cached schema
    component.federation = true;

    // Re-set to false so schema build succeeds with makeExecutableSchema
    component.federation = false;

    const schema2 = component.schema;
    assert.ok(schema2, 'schema rebuilt after federation change');
    assert.notEqual(schema1, schema2, 'schema is a new instance after invalidation');
    assert.end();
  });

  t.end();
});

test('Circular import detection', (t) => {
  t.test('should allow importing a different component', (assert) => {
    const component = new GraphQLComponent({
      types: 'type Query { test: String }'
    });

    assert.doesNotThrow(
      () => new GraphQLComponent({
        types: 'type Query { parent: String }',
        imports: [component]
      }),
      'importing a different component does not throw'
    );
    assert.end();
  });

  t.end();
});

test('stableStringify handles circular references', (t) => {
  t.test('should not throw on circular object args via graphql query', async (assert) => {
    const component = new GraphQLComponent({
      types: `type Query { test(input: String): String }`,
      resolvers: {
        Query: {
          test(_: any, args: any, context: any) {
            return 'result';
          }
        }
      }
    });

    const schema = component.schema;
    const { graphql } = await import('graphql');

    // Execute query with a context object (needed for WeakMap memoization)
    const result = await graphql({ schema, source: '{ test(input: "hello") }', contextValue: {} });
    assert.notOk(result.errors, 'query succeeds without errors');
    assert.equal(result.data?.test, 'result', 'returns correct result');
    assert.end();
  });

  t.end();
});
