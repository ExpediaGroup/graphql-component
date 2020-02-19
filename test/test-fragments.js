const test = require('tape');
const GraphQLComponent = require('../lib/index');

test('fragment building from merged types', async (t) => {
  t.test(`component with 1 'vanilla' type (no list or non-nullables)`, async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          value: String
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 1, '1 fragment built');
    st.equal(fragments[0], 'fragment AllA on A { value }', `vanilla type fragment built as expected`);
    st.end();
  });

  t.test('component with 1 type whose field is a list type', async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          aList: [String]
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 1, '1 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { aList }', 'fragment for type with list field built as expected');
    st.end();
  });

  t.test('component with 1 type whose field is non-nullable', async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          nonNullableValue: String!
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 1, '1 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { nonNullableValue }', 'fragment for type with non-nullable field built as expected');
    st.end();
  });

  t.test(`component with 1 'vanilla' type that references another 'vanilla' type`, async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          aValue: String
          b: B
        }
        
        type B {
          bValue: String
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 2, '2 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { aValue, b { ...AllB } }', `child type's fragment is used for expanding child type in parent type's fragment`);
    st.equal(fragments[1], 'fragment AllB on B { bValue }', 'child type fragment built as expected');
    st.end();
  });

  t.test(`component with 1 'vanilla' type that references another type as a list`, async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          aValue: String
          b: [B]
        }
        
        type B {
          bValue: String
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 2, '2 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { aValue, b { ...AllB } }', `child type's fragment is used for expanding child type in parent type's fragment`);
    st.equal(fragments[1], 'fragment AllB on B { bValue }', 'child type fragment built as expected');
    st.end();
  });

  t.test(`component with type that references another type as a list with all non-null combinations`, async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          aValue: String
          b: [B]!
          c: [B!]!
          d: [B!]
          e: [B]
        }
        
        type B {
          bValue: String
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 2, '2 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { aValue, b { ...AllB }, c { ...AllB }, d { ...AllB }, e { ...AllB } }', `child type's fragment is used for expanding child type in parent type's fragment`);
    st.equal(fragments[1], 'fragment AllB on B { bValue }', 'child type fragment built as expected');
    st.end();
  });

  t.test(`component with 3 type transitive relationship`, async (st) => {
    const component = new GraphQLComponent({
      types: [`
        type A {
          aValue: String
          b: [B]
        }
        
        type B {
          bValue: String
          c: C!
        }

        type C {
          cValue: Int
        }
      `]
    });

    const { _fragments: fragments } = component;
    st.equal(fragments.length, 3, '3 fragments built');
    st.equal(fragments[0], 'fragment AllA on A { aValue, b { ...AllB } }', `child type's fragment is used for expanding child type in parent type's fragment`);
    st.equal(fragments[1], 'fragment AllB on B { bValue, c { ...AllC } }', 'child type fragment is used for expanding child type in parent');
    st.equal(fragments[2], 'fragment AllC on C { cValue }', 'child type fragment created as expected')
    st.end();
  });
});