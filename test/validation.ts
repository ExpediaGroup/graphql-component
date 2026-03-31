import test from 'tape';
import GraphQLComponent, { IGraphQLComponent, IGraphQLComponentConfigObject } from '../src/index';
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';

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

test('GraphQLComponent Import Handling', (t) => {
  t.test('should wrap GraphQLComponent instance in config object', (assert) => {
    const childComponent = new GraphQLComponent({
      types: ['type Query { child: String }']
    });
    
    const parentComponent = new GraphQLComponent({
      types: ['type Query { parent: String }'],
      imports: [childComponent]
    });

    assert.ok(parentComponent.imports, 'imports array exists');
    assert.equals(parentComponent.imports.length, 1, 'has one import');
    assert.ok(parentComponent.imports[0].component, 'import has component property');
    assert.equals(parentComponent.imports[0].component, childComponent, 'component matches');
    assert.end();
  });

  t.test('should accept IGraphQLComponentConfigObject without wrapping', (assert) => {
    const childComponent = new GraphQLComponent({
      types: ['type Query { child: String }']
    });
    
    const configObject: IGraphQLComponentConfigObject = {
      component: childComponent
    };
    
    const parentComponent = new GraphQLComponent({
      types: ['type Query { parent: String }'],
      imports: [configObject]
    });

    assert.ok(parentComponent.imports, 'imports array exists');
    assert.equals(parentComponent.imports.length, 1, 'has one import');
    assert.ok(parentComponent.imports[0].component, 'import has component property');
    assert.equals(parentComponent.imports[0].component, childComponent, 'component matches');
    assert.end();
  });

  t.test('should wrap custom IGraphQLComponent implementation', (assert) => {
    // Create a custom implementation of IGraphQLComponent
    const customComponent: IGraphQLComponent = {
      get name() {
        return 'CustomComponent';
      },
      get schema() {
        return new GraphQLSchema({
          query: new GraphQLObjectType({
            name: 'Query',
            fields: {
              custom: {
                type: GraphQLString,
                resolve: () => 'custom value'
              }
            }
          })
        });
      },
      get context() {
        const fn = async (ctx: Record<string, unknown>) => ctx;
        fn.use = () => () => {};
        return fn;
      },
      get types() {
        return ['type Query { custom: String }'];
      },
      get resolvers() {
        return {
          Query: {
            custom: () => 'custom value'
          }
        };
      },
      get imports() {
        return undefined;
      },
      get dataSources() {
        return [];
      },
      get dataSourceOverrides() {
        return [];
      }
    };
    
    const parentComponent = new GraphQLComponent({
      types: ['type Query { parent: String }'],
      imports: [customComponent]
    });

    assert.ok(parentComponent.imports, 'imports array exists');
    assert.equals(parentComponent.imports.length, 1, 'has one import');
    assert.ok(parentComponent.imports[0].component, 'import has component property');
    assert.equals(parentComponent.imports[0].component, customComponent, 'component matches');
    assert.equals(parentComponent.imports[0].component.name, 'CustomComponent', 'custom component name preserved');
    assert.end();
  });

  t.test('should handle mixed imports (GraphQLComponent and config objects)', (assert) => {
    const component1 = new GraphQLComponent({
      types: ['type Query { one: String }']
    });
    
    const component2 = new GraphQLComponent({
      types: ['type Query { two: String }']
    });
    
    const configObject: IGraphQLComponentConfigObject = {
      component: component2
    };
    
    const parentComponent = new GraphQLComponent({
      types: ['type Query { parent: String }'],
      imports: [component1, configObject]
    });

    assert.equals(parentComponent.imports.length, 2, 'has two imports');
    assert.ok(parentComponent.imports[0].component, 'first import has component');
    assert.ok(parentComponent.imports[1].component, 'second import has component');
    assert.equals(parentComponent.imports[0].component, component1, 'first component matches');
    assert.equals(parentComponent.imports[1].component, component2, 'second component matches');
    assert.end();
  });

  t.test('should not mutate federation flag on imported components when parent has federation', (assert) => {
    const childComponent = new GraphQLComponent({
      types: ['type Query { child: String }']
    });

    assert.notOk(childComponent.federation, 'child component federation is false initially');

    const parentComponent = new GraphQLComponent({
      types: ['type Query { parent: String }'],
      imports: [childComponent],
      federation: true
    });

    assert.notOk(childComponent.federation, 'child component federation is not mutated by parent');
    assert.ok(parentComponent.federation, 'parent federation is true');
    assert.end();
  });

  t.test('should not mutate federation flag on shared component imported by multiple parents', (assert) => {
    const sharedComponent = new GraphQLComponent({
      types: ['type Query { shared: String }']
    });

    assert.notOk(sharedComponent.federation, 'shared component federation is false initially');

    const federatedParent = new GraphQLComponent({
      types: ['type Query { fedParent: String }'],
      imports: [sharedComponent],
      federation: true
    });

    const nonFederatedParent = new GraphQLComponent({
      types: ['type Query { nonFedParent: String }'],
      imports: [sharedComponent]
    });

    assert.notOk(sharedComponent.federation, 'shared component federation is still false');
    assert.ok(federatedParent.federation, 'federated parent is true');
    assert.notOk(nonFederatedParent.federation, 'non-federated parent is false');
    assert.end();
  });

  t.end();
}); 