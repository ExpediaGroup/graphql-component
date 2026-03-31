import test from 'tape';
import GraphQLComponent from '../src/index';
import { MapperKind } from '@graphql-tools/utils';
import { GraphQLFieldConfig } from 'graphql';

test('GraphQLComponent Schema Tests', (t) => {
  t.test('should create basic schema', (assert) => {
    const types = `
      type Query {
        hello: String
      }
    `;
    
    const resolvers = {
      Query: {
        hello: () => 'world'
      }
    };

    const component = new GraphQLComponent({ types, resolvers });
    assert.ok(component.schema, 'schema was created');
    assert.end();
  });

  t.test('should handle schema transforms', (assert) => {
    const types = `
      type Query {
        hello: String
      }
    `;
    
    const transforms = [{
      [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
        if (fieldName === 'hello') {
          return {
            ...fieldConfig,
            description: 'A hello world field'
          };
        }
        return fieldConfig;
      }
    }];

    const component = new GraphQLComponent({ types, transforms, resolvers: {
      Query: {
        hello: () => 'world'
      }
    } });
    assert.ok(component.schema?.getQueryType()?.getFields().hello.description === 'A hello world field', 'transform was applied');
    assert.end();
  });

  t.test('should apply transforms correctly after schema invalidation', (assert) => {
    const types = `
      type Query {
        hello: String
      }
    `;

    const transforms = [{
      [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<unknown, unknown>, fieldName: string) => {
        if (fieldName === 'hello') {
          return {
            ...fieldConfig,
            description: 'Transformed field'
          };
        }
        return fieldConfig;
      }
    }];

    const component = new GraphQLComponent({ types, transforms, resolvers: {
      Query: {
        hello: () => 'world'
      }
    } });

    // First access - transforms should apply
    const schema1 = component.schema;
    assert.ok(schema1.getQueryType()?.getFields().hello.description === 'Transformed field', 'transform applied on first access');

    // Invalidate and re-access - transforms should still apply
    component.invalidateSchema();
    const schema2 = component.schema;
    assert.ok(schema2.getQueryType()?.getFields().hello.description === 'Transformed field', 'transform applied after invalidation');
    assert.notEqual(schema1, schema2, 'new schema instance after invalidation');
    assert.end();
  });

  t.end();
}); 