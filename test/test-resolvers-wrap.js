
const Test = require('tape');
const Resolvers = require('../lib/resolvers');

Test('fixture wrapping', (t) => {

  const resolvers = {
    Query: {
      test() {
        throw new Error('not implemented');
      }
    }
  };

  const fixtures = {
    Query: {
      test() {
        //no-op
      }
    }
  };

  t.test('wrap resolver in fixture behind flag', async (t) => {

    t.plan(1);

    const wrapped = Resolvers.wrapResolvers(resolvers, fixtures);

    try {
      await wrapped.Query.test()
    }
    catch (error) {
      t.pass('expected error');
    }
  });

  t.test('wrap resolver in fixture', async (t) => {

    t.plan(1);

    const wrapped = Resolvers.wrapResolvers(resolvers, fixtures, undefined, true);

    try {
      await wrapped.Query.test();
      t.pass('intercepted');
    }
    catch (error) {
      t.fail('should not have had error');
    }

    wrapped.Query.test();
  });

});