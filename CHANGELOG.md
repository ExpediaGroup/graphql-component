# 2.0.4

- Fixed the error path on errors surfaced through `delegateToComponent()` calls such that error path takes into account the already traversed path and exclusions
- Variables from an outer operation are no longer forwarded to the sub operation created by `delegateToComponent()` this is to avoid passing along variables for types that dont exist in the schema being delegated to.

# 2.0.3

- Fixed individual field exclusions during import - individual field exclusions will no longer modify the original resolver map that is being imported.
- Fixed/tightened up argument forwarding when using `delegateToComponent()` - only arguments the target field is expecting   will be extracted from the calling resolver or from the `args` object provided to `delegateToComponent()` depending on the situation. Previously, there were some unintended argument leakage in certain edge cases.

# 2.0.2

- Fixed importing directives

# 2.0.1

- Fixed error merging to iteratively consider the merge path to properly merge errors in complex situations such as lists

### 2.0.0

- [BREAKING] removed fragment helpers
- [BREAKING] `schemaDirectives` (which returned merged directives) removed from component api
- [BREAKING] removed `proxyImportedResolvers` feature flag
- [BREAKING] removed `execute`
- [FEATURE] added `delegateToComponent` to replace `execute`
- [FEATURE] args can be overridden/passed via `delegateToComponent`
- [FEATURE] added `targetRootField` option to `delegateToComponent`
- [FIXED] delegation for subscription operations
- [FIXED] Memoizing resolvers didn't take into account aliased requests
- [FIXED] delegating an operation that contains an abstract type
- [DOCS] added documentation for `delegateToComponent`
- [CLEANUP] use fieldNodes to build sub-operation document in delegateToComponent such that the original operation document isn't unintentionally modified
- [CLEANUP] removal of proxy resolvers creation when importing resolvers
- [CLEANUP] Refactor how imports are merged together to be optimized and only run when a schema is requested
- [CLEANUP] Moved tests alongside source code

### v1.3.1

- Fixed exclude mapping in GraphQLComponent constructor - Array.map was erroniously changed to Array.filter

### v1.3.0

- Imported resolvers will delegate to the imported component schema to which they belong.
- Remove `this._context` as default value for context in `execute()` requiring `execute()` users to pass in context from a calling resolver.
- Remove binding of `GraphQLComponent` class context to Subscription resolvers.
- Apply proxyImportedResolvers regardless of how the way a component is imported and whether or not exclusions are provided. proxyImportedResolvers can still be turned off for an imported component if the component is passed via config object.

### v1.2.4

- Execute flag `mergeErrors` allows inline errors to facilitate returning multiple errors from resolvers that use `execute`.

### v1.2.3

- Allow extended properties in federated schema with custom directives

### v1.2.2

- Allow custom directives in federation (#40)

### v1.2.1

- Clean up empty types that were excluded (#38)
- Reduced package size with npmignore

### v1.2.0

- Added federation support
- New license copyright

### v1.1.3

- Fixed data source proxy losing instance binding
- Upgraded to graphql peer ^14

### v1.1.1

- `execute` now supports both document objects and strings.

### v1.1.1

- [BREAKING from 1.1.0 (sorry, but it is 5 minutes later)]: data sources appear by constructor name on context

### v1.1.0

- Added first class data source support and overriding

### v1.0.4

- Fixes #23

### v1.0.3

- Disabling type resolvers from memoization — this doesn't work right for type resolvers.

### v1.0.2

- Outer global context setup occurs only once when `context` is fetched off component.

### v1.0.1

- Fixed .npmignore to not include misc files that added to the package size

### v1.0.0 — promoted from alpha.23
