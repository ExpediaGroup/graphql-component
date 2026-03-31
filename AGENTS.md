# Agent Instructions

Authoritative instructions for AI agents working in this repository. Use as guidance; let the model reason rather than follow templates mechanically.

---

## Project

**graphql-component** -- a library for building modular, composable GraphQL schemas through a component-based architecture. Components encapsulate types, resolvers, data sources, and context. Composition happens via `@graphql-tools/stitch`. Also supports Apollo Federation, mocking, schema transforms, and schema pruning.

**Author**: Trevor Livingston
**License**: MIT
**Repo**: github.com/ExpediaGroup/graphql-component

---

## Tech Stack

- **Language**: TypeScript (strict mode expected)
- **Runtime**: Node.js >= 18
- **GraphQL**: graphql ^16.0.0 (peer dependency)
- **Schema tooling**: @graphql-tools/* (stitch, merge, delegate, schema, mock, utils)
- **Federation**: @apollo/federation ^0.38.1 (deprecated; migration to @apollo/subgraph planned)
- **Test framework**: Tape (TAP output) with Sinon for spies/mocks
- **Coverage**: NYC
- **Linting**: ESLint with @typescript-eslint

---

## Commands

| Task | Command |
|------|---------|
| Build | `npm run build` (runs `tsc`) |
| Test | `npm test` |
| Lint | `npm run lint` |
| Coverage | `npm run cover` |
| Composition example | `npm run start-composition` |
| Federation example | `npm run start-federation` |

---

## Source Structure

```
src/index.ts          -- entire library (single file: class, types, helpers)
test/                 -- Tape test files (*.ts)
examples/             -- composition, federation, context-middleware demos
dist/                 -- compiled output (do not edit)
```

The library is a single-file module. All exports come from `src/index.ts`. The main class is `GraphQLComponent`. Helper functions (`memoize`, `bindResolvers`, `createDataSourceContextInjector`) are module-private.

---

## Key Architectural Concepts

- **GraphQLComponent class**: the core unit. Encapsulates types, resolvers, data sources, context, and imports.
- **Schema composition**: parent components import children; schemas merge via `stitchSchemas()`. Standalone components use `makeExecutableSchema()` or `buildFederatedSchema()`.
- **Data source injection**: uses `Proxy` to transparently inject per-request context as the first argument to data source methods. Dual type system: `DataSourceDefinition<T>` (implementation, includes context param) and `DataSource<T>` (consumption, context stripped).
- **Query memoization**: Query resolvers are wrapped with a WeakMap-based per-request cache keyed by `path_args`.
- **Context flow**: data source injection -> import data source injection -> middleware -> import context resolution (parallel) -> namespace context.
- **Disposal**: `dispose()` nulls all fields; every getter checks `_assertNotDisposed()`.

---

## Editing Expectations

- Read `src/index.ts` before modifying; the entire library is one file.
- Changes to core behavior require updating or adding tests in `test/`.
- Run `npm test` after any change. All 156 tests must pass.
- Run `npx tsc --noEmit` to verify type safety without building.
- Prefer editing existing code over creating new files.
- Do not add comments explaining what code does; only explain why when non-obvious.

---

## Code Style (TypeScript)

- 2-space indentation
- Single quotes for strings
- Semicolons always
- `const` for single assignment, `let` when reassigned, never `var`
- `else` / `catch` on new line
- All scopes wrapped in `{ }`
- No `any` unless suppressed by eslint comment with justification
- Use arrow functions when `this` binding is needed; use `function` keyword otherwise
- Early returns to flatten logic; avoid deep nesting

---

## High-Risk Boundaries

- **Schema building** (`get schema`): cached and lazy. `invalidateSchema()` clears cache. Transforms are also cached in `_transformedSchema`. Modifying caching behavior can break memoization guarantees.
- **Data source proxy** (`createDataSourceContextInjector`): intercepts all property access. Changes here affect every data source method call in every component.
- **Context flow**: the context getter consolidates data source injection, middleware, import processing, and namespace application. Order matters; changes to sequencing break downstream assumptions.
- **Resolver binding** (`bindResolvers`): binds `this` to the component instance. Query resolvers are additionally memoized. Mutations and subscriptions must NOT be memoized.
- **Module exports**: dual export for ESM and CommonJS compatibility (`module.exports = GraphQLComponent; module.exports.default = GraphQLComponent`). Do not remove either.

---

## Testing

- Framework: Tape (TAP protocol). Tests use `t.test()` nesting, `t.equal`, `t.deepEqual`, `t.ok`, `t.throws`, `t.doesNotThrow`.
- Test files: `test/*.ts` (context, datasources, dispose, error-handling, import-context-async, performance-regression, schema, test, validation).
- When changing behavior, update an existing test or add a new one that would fail without the change.
- Performance regression tests exist (`test/performance-regression.ts`) -- verify parallel processing timing, memoization, proxy isolation.

---

## Contribution Rules

- Always write tests when introducing new behavior.
- Warn about breaking changes explicitly.
- Avoid introducing new dependencies; ask before adding one.
- Make the minimal change possible to achieve the requested outcome.
- Create examples under `/examples` when demonstrating complex ideas.
- Call out potential performance, security, and resilience issues when you encounter them.

---

## Quality Rules

- Improve clarity and quality of code you touch.
- Do not preserve poor design solely because it already exists.
- Avoid expanding scope beyond the requested change.
- Architectural changes are allowed when they simplify the system, but must be explicit.
- Duplication is acceptable until a stable abstraction boundary is clear.
- Be strict at system boundaries; internals may rely on types and invariants.
- Fail fast; prefer explicit outcomes over silent failures.
