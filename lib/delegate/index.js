
const {
  Kind,
  execute,
  subscribe,
  isAbstractType,
  isObjectType,
  print,
  astFromValue,
  coerceInputValue,
  TypeInfo,
  TypeNameMetaFieldDef,
  visit,
  visitWithTypeInfo,
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
    
    const callingResolverArgs = [];
    for (const fieldNode of info.fieldNodes) {
      if (fieldNode.arguments && fieldNode.arguments.length > 0) {
        callingResolverArgs.push(...fieldNode.arguments);
      }
    }

    for (const definedArg of definedRootFieldArgs) {
      if (args[definedArg.name]) {
        // coerceInputValue: https://github.com/graphql/graphql-js/blob/v14.7.0/src/utilities/coerceInputValue.js
        // is used to take the JS value provided by the caller of 
        // delegateToComponent and coerce it to the JS value associated with 
        // the type of the associated GraphQL argument - this will throw an 
        // error if there is a type mismatch - you wont know until query 
        // execution time if an error will occur here
        const coercedArgValue = coerceInputValue(args[definedArg.name], definedArg.type);
        const argValueNode = astFromValue(coercedArgValue, definedArg.type);
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

  // assemble the document object which includes the operation definition
  // and fragment definitions (if present)
  const document = { kind: Kind.DOCUMENT, definitions };

  const typeInfo = new TypeInfo(component.schema);
  const visitFunctions = {};
  // if the schema we are delegating to has abstract types
  // add a visitor function that traverses the selection sets
  // and adds __typename to the selection set for return types
  // that are abstract
  if (component.schema.toConfig().types.some((type) => isAbstractType(type))) {
    visitFunctions[Kind.SELECTION_SET] = function (node) {
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
  }

  // prune selection set fields that are not defined in the target schema
  visitFunctions[Kind.FIELD] = function (node) {
    const parentType = typeInfo.getParentType();
    if (isObjectType(parentType) || isAbstractType(parentType)) {
      const parentTypeFields = parentType.getFields();
      const field = node.name.value === '__typename' ? TypeNameMetaFieldDef : parentTypeFields[node.name.value];

      if (!field) {
        return null;
      }
    }
  }

  // if the outer operation has variable definitions, determine
  // which ones are used in the delegated document and prune out
  // any variable definitions that aren't used
  const variableDefinitions = new Set();
  if (info.operation.variableDefinitions.length > 0) {
    visitFunctions[Kind.VARIABLE] = function (node) {
      const matchingVarDef = info.operation.variableDefinitions.find((varDef) => varDef.variable.name.value === node.name.value);
      if (matchingVarDef) {
        variableDefinitions.add(matchingVarDef);
      }
    }
  }

  // modify the above constructed document via visit() functions
  const modifiedDelegateDocument = visit(document, visitWithTypeInfo(typeInfo, visitFunctions));

  // TODO: there may be a more elegant way to add the variable definitions to
  // the document, but we do know that the operation definition is the first
  // definition in the definitions array due to the above construction
  modifiedDelegateDocument.definitions[0].variableDefinitions = Array.from(variableDefinitions);
  return modifiedDelegateDocument;
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
      contextValue,
      variableValues: info.variableValues
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
    contextValue,
    variableValues: info.variableValues
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
