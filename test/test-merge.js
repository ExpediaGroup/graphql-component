
const Test = require('tape');
const Merge = require('../lib/merge');

Test('merge', async (t) => {

  t.test('merge resolvers', (t) => {
    t.plan(3);

    const resolvers = {
      Query: {
        test: () => {}
      }
    };

    const merge = {
      Query: {
        merge: () => {}
      },
      Mutation: {
        merge: () => {}
      }
    };

    const merged = Merge.mergeResolvers(resolvers, merge);

    t.ok(merged.Query.test, 'original present');
    t.ok(merged.Query.merge, 'merged present');
    t.ok(merged.Mutation.merge, 'merged present');

  });

  t.test('merge resolvers no args', (t) => {
    t.plan(1);

    const merged = Merge.mergeResolvers();

    t.ok(merged, 'something was returned');
  });

});