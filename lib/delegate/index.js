
const { 
  Kind,
  execute,
  subscribe,
  isAbstractType,
  getNamedType,
  print,
  astFromValue,
  coerceInputValue,
  TypeInfo,
  visit,
  visitWithTypeInfo
} = require('graphql');
const set = require('lodash.set');
const get = require('lodash.get');
const debug = require('debug')('graphql-component:delegate');

/**
 * extracts the Array<SelectionNode> at the given path
 * @param {String} path - dot seperated string defining the path to the sub 
 * selection
 * @param {Array<SelectionNode>} selections - an array of SelectionNode objects
 * @returns {Array<SelectionNode>} - an array of SelectionNode objects
 * representing the sub selection set at the given sub path
 */
const getSelectionsForSubPath = function(path, selections) {
  if (!path) {
    return selections;
  }
  const parsedPath = path.split('.');
  const getSelections = function (name, selections) {
    for (const selection of selections) {
      if ((selection.name && selection.name.value === name) || (selection.alias && selection.alias.value === name)) {
        return selection.selectionSet && selection.selectionSet.selections;
      }
    }
  };

  let pathSegment = parsedPath.shift();
  let subSelections = getSelections(pathSegment, selections);
  while (parsedPath.length > 0 && !subSelections) {
    pathSegment = parsedPath.shift();
    subSelections = getSelections(pathSegment, subSelections);
  }

  if (subSelections) {
    return subSelections;
  }
  return selections;
}

const createSubOperationDocument = function (component, targetRootField, args, subPath, info) {

  // grab the selections starting at the calling resolver forward
  let selections = [];
  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet && fieldNode.selectionSet.selections) {
      selections.push(...fieldNode.selectionSet.selections);
    }
  }

  // reduce the selection set to the specified sub path if provided
  selections = getSelectionsForSubPath(subPath, selections);

  let targetRootTypeFields;
  if (info.operation.operation === 'query') {
    targetRootTypeFields = component.schema.getQueryType().getFields();
  } 
  else if (info.operation.operation === 'mutation') {
    targetRootTypeFields = component.schema.getMutationType().getFields();
  } 
  else if (info.operation.operation === 'subscription') {
    targetRootTypeFields = component.schema.getSubscriptionType().getFields();
  }

  // get the arguments defined by the target root field
  const definedRootFieldArgs = [];
  for (const [fieldName, fieldValue] of Object.entries(targetRootTypeFields)) {
    if (fieldName === targetRootField) {
      definedRootFieldArgs.push(...fieldValue.args);
    }
  }

  const targetRootFieldArguments = [];
  // skip argument processing if the target root field doesn't have any arguments
  if (definedRootFieldArgs.length > 0) {
    // get the calling resolver's arguments
    const callingResolverArgs = [];
    for (const fieldNode of info.fieldNodes) {
      if (fieldNode.arguments && fieldNode.arguments.length > 0) {
        callingResolverArgs.push(...fieldNode.arguments);
      }
    }

    // for each argument defined for the target root field
    // check if the caller of delegateToComponent provided an argument of
    // the same name (and type) and forward it on if so
    // if not - check the calling resolver's args for an argument of the
    // same name and forward it if so.
    for (const definedArg of definedRootFieldArgs) {
      // a caller of delegateToComponent provided an argument that matches
      // the target root field's argument name
      if (args[definedArg.name]) {
        const definedArgNamedType = getNamedType(definedArg.type);
        // this provides us some type safety by trying to coerce the user's
        // argument value to the type defined by the target field's matching 
        // argument - if they dont match, it will throw a meaningful error.
        // without this astFromValue would coerce things we dont want coerced
        const coercedArgValue = coerceInputValue(args[definedArg.name], definedArgNamedType);
        const argValueNode = astFromValue(coercedArgValue, definedArgNamedType);
        targetRootFieldArguments.push({
          kind: Kind.ARGUMENT,
          name: { kind: Kind.NAME, value: definedArg.name },
          value: argValueNode
        });
      }
      else {
        // search the calling resolver's arguments for an arg with the same
        // name as the target root field's defined argument
        const matchingArgIdx = callingResolverArgs.findIndex((argNode) => {
          return argNode.name.value === definedArg.name;
        });

        if (matchingArgIdx !== -1) {
          targetRootFieldArguments.push(callingResolverArgs[matchingArgIdx]);
        }
      }
    }
  }

  const targetRootFieldNode = {
    kind: Kind.FIELD,
    arguments: targetRootFieldArguments,
    name: { kind: Kind.NAME, value: targetRootField },
    selectionSet: { kind: Kind.SELECTION_SET, selections }
  };

  const operationDefinition = {
    kind: Kind.OPERATION_DEFINITION,
    operation: info.operation.operation,
    selectionSet: { kind: Kind.SELECTION_SET, selections: [targetRootFieldNode]}
  };

  const definitions = [operationDefinition];
  for (const [, fragmentDefinition] of Object.entries(info.fragments)) {
    definitions.push(fragmentDefinition);
  }

  const document = { kind: Kind.DOCUMENT, definitions };
  const schemaConfig = component.schema.toConfig();
  // only perform the below traversal if the delegatee's schema has an
  // abstract type that is implemented
  if (schemaConfig.types.some((type) => isAbstractType(type))) {
    const typeInfo = new TypeInfo(component.schema);
    // traverse the document's selection sets and add __typename to the
    // selection set for any field that is an abstract type
    return visit(document, visitWithTypeInfo(typeInfo, {
      [Kind.SELECTION_SET](node) {
        const parentType = typeInfo.getParentType();
        let nodeSelections = node.selections;
        if (parentType && isAbstractType(parentType)) {
          nodeSelections = nodeSelections.concat({
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: '__typename'
            }
          });
        }

        if (nodeSelections !== node.selections) {
          return {
            ...node,
            selections: nodeSelections
          }
        }
      }
    }));
  }
  return document;
}

/**
 * merges errors in the input errors array into data based on the error path
 * @param {object} data - the data portion of a graphql result 
 * @param {Array<object>} errors - the errors portions of a graphql result
 * @param {GraphQLResolveInfo} info - the info object from the resolver who
 * called delegateToComponent
 * @returns - nothing - modifies data parameter by reference 
 */
const mergeErrors = function (data, errors, info) {
  // use info to build the path tha was traversed prior to the delegateToComponent call
  const prePath = [];
  let curr = info.path;
  while (curr) {
    prePath.unshift(curr.key);
    curr = curr.prev;
  }

  for (let error of errors) {
    
    const { path } = error;
    // errors can occur via graphql.execute() that occur before
    // actual execution occurs with which the error won't have a path
    // in which case we'll just throw it and fail fast.
    if (path) {
      let depth = 1;
      while (depth <= path.length) {
        if (!get(data, path.slice(0, depth))) {
          break;
        }
        depth++;
      }

      // merge the error in at a slice path (this is to handle nullability)
      set(data, path.slice(0, depth), error);

      // modify the error's path
      const returnTypeASTNode = info.returnType.astNode ? info.returnType.astNode : info.returnType.ofType.astNode;
      // if the first segment of the error path is a field on the return type
      // of the calling resolver it will remain part of the adjusted path
      // otherwise we will remove it since that first segment represents
      // the resolver field we delegated to which is a detail we want to
      // abstract away from the outer operation
      if (!returnTypeASTNode.fields.find((field) => field.name.value === error.path[0])) {
        error.path.shift();
      }
      error.path.unshift(...prePath);
    }
    else {
      throw error;
    }
  }
}

/**
 * executes (delegates) a graphql operation on the input component's schema
 * @param {GraphQLComponent} component - the component to delegate execution to
 * @param {object} options - an options object to customize the delegated 
 * operation
 * @param {GraphQLResolveInfo} options.info - the info object from the calling resolver
 * @param {object} options.contextValue - the context object from the calling 
 * resolver
 * @param {string} [options.targetRootField] - the name of the root type field 
 * the delegated operation will execute. Defaults to the field name of the 
 * calling resolver
 * @param {string} [options.subPath] - a dot separated string to limit the 
 * delegated selection set to a given path in the calling resolver's return type
 * @param {object} [options.args] - an object literal whose keys/values are 
 * passed as args to the delegatee's target field resolver.
 * @returns the result of the delegated operation to the targetRootField with
 * any errors merged into the result at their given path
 */
const delegateToComponent = async function (component, options) { 
  let {
    subPath,
    contextValue,
    info,
    targetRootField,
    args = {}
  } = options;

  if (!contextValue) {
    throw new Error('delegateToComponent requires the contextValue from the calling resolver');
  }

  if (!info) {
    throw new Error('delegateToComponent requires the info object from the calling resolver');
  }

  // default the target root field to be the name of the calling resolver
  if (!targetRootField) {
    targetRootField = info.fieldName;
  }

  const document = createSubOperationDocument(component, targetRootField, args, subPath, info);

  debug(`delegating ${print(document)} to ${component.name}`);

  if (info.operation.operation === 'query' || info.operation.operation === 'mutation') {
    let { data, errors = []} = await execute({
      document, 
      schema: component.schema, 
      rootValue: info.rootValue, 
      contextValue
    });

    if (!data) {
      data = {};
    }
    
    if (errors.length > 0) {
      mergeErrors(data, errors, info);
    }
    return data[targetRootField];
  }

  const result = await subscribe({
    document,
    schema: component.schema,
    rootValue: info.rootValue,
    contextValue
  });

  if (Symbol.asyncIterator in result) {
    return {
      async next() {
        const nextResult = await result.next();
        if (nextResult.done) {
          return nextResult;
        }

        let { value: { data, errors = []}} = nextResult;

        if (!data) {
          data = {};
        }

        if (errors.length > 0) {
          mergeErrors(data, errors, info);
        }

        return { done: false, value: { [targetRootField]: nextResult.value.data[targetRootField]}};
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    }
  }
};

module.exports = { delegateToComponent };