
export declare class GraphQLComponent {
  constructor({ types, resolvers, imports, mocks, directives, context, useMocks, preserveTypeResolvers }?: {
    types?: any[];
    resolvers?: {};
    imports?: any[];
    mocks?: any;
    directives?: any;
    context?: any;
    useMocks?: boolean;
    preserveTypeResolvers?: boolean;
  });
  static isComponent(check: any): any;
  execute(input: any, { root, context, variables }?: {
    root?: any;
    context?: {};
    variables?: {};
  }): Promise;
  readonly schema: any;
  readonly context: {
    (arg: any): Promise;
    use(name: any, fn: any): void;
  };
  readonly types: any[];
  readonly resolvers: any;
  readonly imports: any[];
  readonly mocks: any;
}