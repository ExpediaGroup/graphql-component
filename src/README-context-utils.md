# Context Utilities for GraphQL Component

This package includes utility types to help with TypeScript type safety when composing GraphQL components.

## Merging Component Contexts

When composing multiple GraphQL components, you often need to merge their contexts to maintain type safety. The `MergeComponentContexts` utility type helps with this.

### Example Usage

```typescript
import { MergeComponentContexts } from 'graphql-component';
import UserComponentContext from './user-component/context';
import ProductComponentContext from './product-component/context';
import OrderComponentContext from './order-component/context';

// Define the merged context type using the utility
type ComposedComponentContext = MergeComponentContexts<[
  UserComponentContext,
  ProductComponentContext,
  OrderComponentContext
]>;

// Use in your component
export default class ComposedComponent extends GraphQLComponent<ComposedComponentContext> {
  constructor(options = {}) {
    const userComponent = new UserComponent();
    const productComponent = new ProductComponent();
    const orderComponent = new OrderComponent();

    super({
      imports: [
        { component: userComponent },
        { component: productComponent },
        { component: orderComponent }
      ],
      // ...other options
    });
  }
}
```

This will properly merge the `dataSources` from all the imported components, providing full type safety.

## Benefits

- Type-safe access to all data sources from imported components
- Autocomplete support in your IDE
- Type checking for resolver functions
- No need to manually maintain merged context types 