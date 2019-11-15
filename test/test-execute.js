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
    t.plan(1);

    const query = `
      query {
        book(id: 1) {
          title
        }
      }
    `;

    const result = await component.execute(query);

    t.deepEqual(result, { book: { title: 'Some Title' } }, 'has result');
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

    const result = await component.execute(query);

    t.deepEqual(result, { book: { title: 'Some Title' } }, 'has result');
  });

  t.test('execute error', async (t) => {
    t.plan(1);

    const query = `
      query {
        book {
          title
        }
      }
    `;

    const result = await component.execute(query);

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

    const result = await component.execute(query);

    t.deepEqual(result, { one: { title: 'Some Title' }, two: { id: '2', title: 'Some Title' } }, 'data returned');
  });

});
