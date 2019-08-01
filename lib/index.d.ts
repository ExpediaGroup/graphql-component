

interface ComponentOptions {
  types?: any[];
  resolvers?: {};
  imports?: any[];
  mocks?: (importedMocks: any) => any;
  directives?: any;
  context?: any;
  useMocks?: boolean;
  preserveTypeResolvers?: boolean;
}

export declare class GraphQLComponent {
  constructor(options?: ComponentOptions);
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
  readonly schemaDirectives: any;
}