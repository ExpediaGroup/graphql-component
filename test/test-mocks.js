'use strict';

const Test = require('tape');
const GraphQLComponent = require('../lib/index');

Test('test component mocks', (t) => {
  t.test('imported mocks', async (t) => {
    t.plan(6);

    const componentA = new GraphQLComponent({
      types: [`
        type A {
          value: String
        }
        type Query {
          a: A
        }
      `],
      mocks: () => ({
        A: () => ({value: 'a'})
      })
    });

    const componentB = new GraphQLComponent({
      types: [`
        type B {
          value: String
        }
        type Query {
          b: B
        }
      `],
      imports: [
        componentA
      ],
      mocks: () => ({
        B: () => ({value: 'b'})
      })
    });

    const componentC = new GraphQLComponent({
      types: [`
        type C {
          value: String
        }
        type Query {
          c: C
        }
      `],
      imports: [
        componentB
      ],
      mocks: () => ({
        C: () => ({value: 'c'})
      }),
      useMocks: true
    });

    t.equal(componentB._importedMocks.A, componentA.mocks.A, 'component B has component A\'s mocks');
    t.equal(componentC._importedMocks.B, componentB.mocks.B, 'component C has component B\'s mocks');
    t.equal(componentC._importedMocks.A, componentA.mocks.A, 'component C has component A\'s mocks');

    const query = `
      query {
        a { value }
        b { value }
        c { value }
      }
    `;
    const result = await componentC.execute(query);

    t.equal(result.a.value, 'a', 'returns Component A\'s mock');
    t.equal(result.b.value, 'b', 'returns Component B\'s mock');
    t.equal(result.c.value, 'c', 'returns Component C\'s mock');
  });
});
