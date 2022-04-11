'use strict';

const test = require('tape');
const { pruneSchema } = require('./index.js');
const { buildASTSchema, parse } = require('graphql');

test('prune empty types and keep pruning dependents', (t) => {
  
  const schema = buildASTSchema(parse(`
    type Query {
      operation: SomeType
      wrongTurn: WrongTurn
      hoisted(testArg: String = "test"): String
    }
    
    interface SomeInterface {
      field: String
    }
    
    type SomeType implements SomeInterface {
      field: String
    }
    
    type ShouldPrune implements SomeInterface {
      field: String
    }
    
    type WrongTurn {
      deadEnd(innerArg: String): End
    }
    
    type End
  `));

  const pruned = pruneSchema(schema);

  t.ok(pruned.getType('Query'), 'Query was retained');
  t.ok(pruned.getType('SomeInterface'), 'SomeInterface was retained');
  t.ok(pruned.getType('SomeType'), 'SomeType was retained');
  t.ok(pruned.getType('Query').getFields()['operation'], 'operation was retained');
  t.ok(pruned.getType('Query').getFields()['hoisted'], 'hoisted was retained');

  t.ok(!pruned.getType('End'), 'End was pruned');
  t.ok(!pruned.getType('WrongTurn'), 'WrongTurn was pruned');
  t.ok(!pruned.getType('Query').getFields()['wrongTurn'], 'wrongTurn was pruned');

  t.end();

});
