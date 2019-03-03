
const Test = require('tape');
const Merge = require('../lib/merge');

Test('merge', async (t) => {

  t.test('merge resolvers', (t) => {
    t.plan(2);

    const resolvers = {
      Query: {
        test: () => {}
      }
    };

    const merge = {
      Query: {
        merge: () => {}
      }
    };

    const merged = Merge.mergeResolvers(resolvers, merge);

    t.ok(merged.Query.test, 'original present');
    t.ok(merged.Query.merge, 'merged present');

  });

});