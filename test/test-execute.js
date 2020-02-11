'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib/index');
const gql = require('graphql-tag');

Test('test component execute', (t) => {

  const types = [`
    type Book {
      id: ID!
      title: String
    }
    type Query {
      book(id: ID!) : Book
    }
  `];

  const resolvers = {
    Query: {
      book(_, { id }) {
        return {
          id,
          title: 'Some Title'
        };
      }
    }
  };

  const component = new GraphQLComponent({
    types,
    resolvers
  });

  t.test('execute query', async (t) => {
    t.plan(2);

    const query = `
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.deepEqual(data, { book: { title: 'Some Title' } }, 'has result');
    t.equal(errors.length, 0, 'no errors');
  });

  t.test('execute query with document object', async (t) => {
    t.plan(1);

    const query = gql`
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { book: { title: 'Some Title' } }, 'has result');
  });

  t.test('execute error', async (t) => {
    t.plan(2);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const { data, errors } = await component.execute(query);

    t.ok(data);
    t.ok(errors && errors.length === 1, 'error');
  });

  t.test('execute error merged', async (t) => {
    t.plan(1);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.ok(result.book instanceof Error, 'error');
  });

  t.test('execute multiple query', async (t) => {
    t.plan(1);

    const query = `
      query {
        one: book(id: 1) {
          title
        }
        two: book(id: 2) {
          id,
          title
        }
      }
    `;

    const result = await component.execute(query, { mergeErrors: true });

    t.deepEqual(result, { one: { title: 'Some Title' }, two: { id: '2', title: 'Some Title' } }, 'data returned');
  });

});
