
const Test = require('tape');
const Resolvers = require('../lib/resolvers');

Test('wrapping', (t) => {

  t.test('wrap resolvers', (t) => {

    t.plan(1);

    const resolvers = {
      Query: {
        test() {
          return this.id;
        }
      }
    };

    const wrapped = Resolvers.wrapResolvers({ id: 1 }, resolvers);

    const value = wrapped.Query.test({}, {}, {});
    
    t.equal(value, 1, 'resolver was bound');
  });

  t.test('memoized resolvers', (t) => {

    t.plan(2);

    let ran = 0;

    const resolvers = {
      Query: {
        test() {
          ran += 1;
          return ran;
        }
      }
    };

    const wrapped = Resolvers.wrapResolvers(undefined, resolvers);

    const ctx = {};
      
    let value = wrapped.Query.test({}, {}, ctx);
    
    t.equal(value, 1, 'expected value');

    value = wrapped.Query.test({}, {}, ctx);
    
    t.equal(value, 1, 'same value, only ran resolver once');
  });

});

Test('memoize resolver', (t) => {

  t.plan(2);

  let ran = 0;

  const resolver = function () {
    ran += 1;
    return ran;
  };

  const wrapped = Resolvers.memoize('Query', 'test', resolver);

  const ctx = {};
  
  let value = wrapped({}, {}, ctx);
  
  t.equal(value, 1, 'expected value');

  value = wrapped({}, {}, ctx);
  
  t.equal(value, 1, 'same value, only ran resolver once');
});

Test('imports', (t) => {

  t.test('get imported resolvers', (t) => {

    t.plan(2);

    const imp = {
      _resolvers: {
        Query: {
          test() {
            return true;
          }
        }
      },
      _importedResolvers: {
        Query: {
          imported() {
            return true;
          }
        }
      }
    };

    const imported = Resolvers.getImportedResolvers(imp);

    t.ok(imported.Query.test, 'resolver present');
    t.ok(imported.Query.imported, 'transitive resolver present');
  });

});