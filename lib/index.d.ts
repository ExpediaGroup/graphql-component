

interface ComponentOptions {
  types?: any[];
  resolvers?: {};
  imports?: any[];
  mocks?: (importedMocks: any) => any;
  directives?: any;
  context?: any;
  useMocks?: boolean;
  preserveResolvers?: boolean;
  dataSources?: any[];
  dataSourceOverrides?: any;
  federation?: boolean;
}

declare class GraphQLComponent {
  constructor(options?: ComponentOptions);
  static isComponent(check: any): any;
  execute(input: any, { root, context, variables }?: {
    root?: any;
    context?: {};
    variables?: {};
  }): Promise<any>;
  readonly schema: any;
  readonly context: {
    (arg: any): Promise<any>;
    use(name: any, fn: any): void;
  };
  readonly types: any[];
  readonly resolvers: any;
  readonly imports: any[];
  readonly mocks: any;
  readonly schemaDirectives: any;
  readonly dataSources: any[];
}

export default GraphQLComponent
