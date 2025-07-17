import test from 'tape';
import GraphQLComponent from '../src/index';
import { MapperKind } from '@graphql-tools/utils';

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
      [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
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

  t.end();
}); 