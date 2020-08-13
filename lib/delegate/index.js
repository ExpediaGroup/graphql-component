
const { Kind, execute, subscribe, isAbstractType, getNamedType, print, astFromValue, coerceInputValue } = require('graphql');
const deepSet = require('lodash.set');
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

  // add in a top level __typename selection if the calling resolver's return type is Abstract
  if (isAbstractType(getNamedType(info.returnType))) {
    selections.push({
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: '__typename' }
    });
  }

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

    // if the user didn't provide args, default to the calling resolver's args
    if (Object.keys(args).length === 0) {
      targetRootFieldArguments.push(...callingResolverArgs);
    }
    else {
      // for each target root field defined argument, see if the user provided
      // an argument of the same name, if so, construct the argument node
      // and remove the calling resolver's matching argument if present
      // so that the user provided arg overrides calling resolver args
      for (const definedArg of definedRootFieldArgs) {
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

          if (callingResolverArgs.length > 0) {
            // if the calling resolver args has a matching argument (same name)
            // remove it so that user provided args "override"
            const matchingArgIdx = callingResolverArgs.findIndex((argNode) => {
              return argNode.name.value === definedArg.name;
            });
            if (matchingArgIdx !== -1) {
              callingResolverArgs.splice(matchingArgIdx, 1);
            }
          }
        }
      }
      // append any remaining calling resolver args
      targetRootFieldArguments.push(...callingResolverArgs);
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
    selectionSet: { kind: Kind.SELECTION_SET, selections: [targetRootFieldNode]},
    variableDefinitions: info.operation.variableDefinitions
  };

  const definitions = [operationDefinition]
  for (const [, fragmentDefinition] of Object.entries(info.fragments)) {
    definitions.push(fragmentDefinition);
  }
  return {
    kind: Kind.DOCUMENT,
    definitions
  };
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
      for (const error of errors) {
        deepSet(data, error.path, error);
      }
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
          for (const error of errors) {
            deepSet(data, error.path, error);
          }
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