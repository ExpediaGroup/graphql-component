
const Test = require('tape');
const Delegates = require('../lib/delegates');

Test('adding delegates', (t) => {

  const resolvers = {};

  const imports = [{
    resolvers: {
      Query: {
        test() {
          return true;
        }
      }
    }
  }];

  t.test('delegate to import', async (t) => {

    t.plan(1);

    const delegate = Delegates.createDelegates(resolvers, imports);

    try {
      t.ok(await delegate.Query.test(), 'received delegate result');
    }
    catch (error) {
      t.fail('should not error')
    }
  });

});