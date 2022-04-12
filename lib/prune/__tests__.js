'use strict';

const test = require('tape');
const { pruneSchema } = require('./index.js');
const { buildASTSchema, parse, printSchema } = require('graphql');

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

test('skip prune type with leaf nodes', (t) => {
  
  const schema = buildASTSchema(parse(`
    type Query {
      operation: SomeType
    }

    type SomeType {
      field: String
    }
    
    type ShouldPrune {
      field: Leaf
    }
    
    scalar Leaf
  `));

  const pruned = pruneSchema(schema, { skipUnusedTypesPruning: true });

  t.ok(pruned.getType('SomeType'), 'SomeType was retained');
  t.ok(pruned.getType('ShouldPrune'), 'ShouldPrune was retained');
  t.ok(pruned.getType('Leaf'), 'Leaf was retained');

  t.end();

});

test('skipPruning checks', (t) => {
  const schema = buildASTSchema(parse(`
    type Query {
      operation: SomeType
    }

    type SomeType {
      field: String
    }
    
    interface LeafInterface {
      id: String
    }

    type ShouldPrune implements LeafInterface {
      id: String
      field: Leaf
    }
    
    scalar Leaf
  `));

  t.test('prune', (t) => {
    const pruned = pruneSchema(schema);
  
    t.ok(pruned.getType('SomeType'), 'SomeType was retained');
    t.ok(!pruned.getType('ShouldPrune'), 'ShouldPrune was pruned');
    t.ok(!pruned.getType('LeafInterface'), 'LeafInterface was pruned');
    t.ok(!pruned.getType('Leaf'), 'Leaf was pruned');
  
    t.end();
  
  });

  t.test('skip prune types with custom skipPruning check', (t) => {
  
    const pruned = pruneSchema(schema, { skipPruning: (type) => type.name === 'ShouldPrune' });
  
    t.ok(pruned.getType('SomeType'), 'SomeType was retained');
    t.ok(pruned.getType('ShouldPrune'), 'ShouldPrune was retained');
    t.ok(pruned.getType('LeafInterface'), 'LeafInterface was retained');
    t.ok(pruned.getType('Leaf'), 'Leaf was retained');
  
    t.end();
  
  });

});