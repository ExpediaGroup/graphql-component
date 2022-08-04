'use strict';

const { exclusions } = require('./index.js');
const Test = require('tape');
const { FilterTypes, FilterObjectFields } = require('@graphql-tools/wrap');

Test('exclusions() accepts null exclude arg', (t) => {
  t.plan(1);
  
  t.doesNotThrow(() => {
    exclusions();
  }, 'does not explode');
});

Test('exclusions() throws an error if passed a malformed exclusion', (t) => {
  try {
    exclusions(['mal.form.ed']);
  } catch (e) {
    t.equals(e.message, `'mal.form.ed' is malformed, should be of form 'type[.[field]]'`)
  }
  t.end();
});

Test('exclusions() simply returns exclusions passed as objects', (t) => {
  const filterType = new FilterTypes();
  const result = exclusions([filterType]);
  console.log(result);
  t.equals(result.length, 1, '1 transform is returned')
  t.equals(result[0], filterType, 'transform is returned as is, since it was an object');
  t.end();
});

Test(`exclusions() converts 'Type' only exclusion to FilterTypes transform`, (t) => {
  const result = exclusions(['Query']);
  t.ok(result[0] instanceof FilterTypes, 'resulting transform is an instance of graphql-tools FilterTypes');
  t.end();
});

Test(`exclusions() converts 'Type.*' exclusion to FilterTypes transform`, (t) => {
  const result = exclusions(['Query.*']);
  t.ok(result[0] instanceof FilterTypes, 'resulting transform is an instance of graphql-tools FilterTypes');
  t.end();
});

Test(`exclusions() converts 'Type.field' exclusion to FilterObjectFields transform`, (t) => {
  const result = exclusions(['Query.foo']);
  t.ok(result[0] instanceof FilterObjectFields, 'resulting transform is instance of graphql-tools FilterObjectFields');
  t.end();
});

// TODO: actual type exclusions tests on GraphQLComponent instances here