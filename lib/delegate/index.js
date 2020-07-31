const { Kind, execute, isAbstractType, getNamedType, print } = require('graphql');
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

const createSubOperationDocument = function (targetRootField, subPath, info) {
  
  // default the selection set we delegate to the complete selection
  // set starting at the calling resolver
  let selections = info.fieldNodes.reduce((acc, fieldNode) => {
    if (fieldNode.selectionSet && fieldNode.selectionSet.selections) {
      return acc.concat(fieldNode.selectionSet.selections)
    }
  }, []);

  // extract the selection set at the specified subPath
  selections = getSelectionsForSubPath(subPath, selections);

  // add in a top level __typename selection if the calling resolver's return type is Abstract
  if (isAbstractType(getNamedType(info.returnType))) {
    selections.push({
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: '__typename' }
    });
  }

  // extract the arguments from the calling resolver
  let newArgs = info.fieldNodes.reduce((acc, fieldNode) => {
    if (fieldNode.arguments) {
      return acc.concat(fieldNode.arguments);
    }
  }, []);

  const targetRootFieldNode = {
    kind: Kind.FIELD,
    arguments: newArgs,
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
 * @returns the result of the delegated operation to the targetRootField with
 * any errors merged into the result at their given path
 */
const delegateToComponent = async function (component, options) { 
  let {
    subPath,
    contextValue,
    info,
    targetRootField
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

  const document = createSubOperationDocument(targetRootField, subPath, info);

  debug(`delegating ${print(document)} to ${component.name}`);

  let { data, errors = [] } = await execute({
    document, 
    schema: component.schema, 
    rootValue: info.rootValue, 
    contextValue, 
    variableValues: info.variableValues
  });

  // data can be completely null and destructuring defaults only apply to undefined
  if (!data) {
    data = {};
  }
  
  if (errors.length > 0) {
    for (const error of errors) {
      deepSet(data, error.path, error);
    }
  }

  return data[targetRootField];
};

module.exports = { delegateToComponent };