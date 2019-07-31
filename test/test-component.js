'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib');

Test('component API', (t) => {

  t.plan(1);

  const component = new GraphQLComponent();

  t.ok(component._id, '_id populated.');
});

Test('component isComponent', (t) => {

  t.test('isComponent not a subclass', (t) => {
    t.plan(1);

    t.ok(!GraphQLComponent.isComponent(Object.create({ types: [], resolvers: {} })), 'not a subclass');
  });

  t.test('isComponent', (t) => {
    t.plan(1);

    t.ok(GraphQLComponent.isComponent(new GraphQLComponent()), 'new super class is component');
  });

  t.test('isComponent subclass', (t) => {
    t.plan(1);

    t.ok(GraphQLComponent.isComponent(new class extends GraphQLComponent {}), 'new subclass is component');
  });
  
});
