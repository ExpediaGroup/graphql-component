const { Kind, execute, isAbstractType, getNamedType} = require('graphql');
const deepSet = require('lodash.set');

/**
 * helper function to extract the so-far traversed path from an info object 
 * passed to resolvers
 * @param {Object} info - the info object passed to resolvers
 * @returns {Array<String>} - the derived path from the input info object
 */
const buildPathFromInfo = function (info) {
  const path = [];
  let current = info.path;

  do {
    path.unshift(current.key);
    current = current.prev;
  }
  while (current !== undefined);

  return path;
};

const getSelectionSetForPath = function (fieldPath, fieldMap, selectionSet) {
  const getSelection = function (name, selections) {
    for (const selection of selections) {
      if (selection.name.value === name || selection.alias.value === name) {
        return selection;
      }
    }
  };

  let path = fieldPath.shift();
  let current = getSelection(path, selectionSet.selections);

  while (fieldPath.length > 0) {
    path = fieldPath.shift();
    current = current && getSelection(path, current.selectionSet.selections);
  }

  return current ? {
    kind: Kind.FIELD,
    alias: current.alias,
    name: {
      name: Kind.NAME,
      value: fieldMap[current.name.value] || current.name.value
    },
    arguments: current.arguments,
    directives: current.directives,
    selectionSet: current.selectionSet
  } : undefined;
};

const createSubOperationForField = function (component, fieldPath, fieldMap, info) {
  const operation = info.operation;
  const fragments = info.fragments;

  // TODO: use this to see if a field exists on underlying component schema
  // const rootType = component.schema.getType(info.parentType.name);
  // const rootFields = rootType.getFields();
  // const returnType = rootFields[fieldPath[fieldPath.length - 1]].type;
  // const returnTypeFields = returnType.getFields();

  const definitions = [];

  if (fragments) {
    for (const [, fragmentDefinition] of Object.entries(fragments)) {
      definitions.push(fragmentDefinition);
    }
  }

  const selections = getSelectionSetForPath([...fieldPath], fieldMap, operation.selectionSet);

  //Add __typename request for usage in __resolveType
  if (selections && selections.selectionSet) {
    if (isAbstractType(getNamedType(info.returnType))) {
      selections.selectionSet.selections.push({
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: '__typename'
        }
      });
    }
  }

  definitions.push({
    kind: Kind.OPERATION_DEFINITION,
    operation: operation.operation,
    variableDefinitions: operation.variableDefinitions,
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [
        selections
      ]
    }
  });

  return {
    kind: Kind.DOCUMENT,
    definitions
  };
};

// Eventually accept an argument to map fields for sub-query?
const delegateToComponent = async function (component, { fieldMap = {}, subPath, contextValue, info }) {
  const rootPath = buildPathFromInfo(info);
  const fieldPath = subPath !== undefined ? [...rootPath, ...subPath.split('.')] : rootPath;

  const { rootValue, variableValues } = info;
  
  const document = createSubOperationForField(component, fieldPath, fieldMap, info);
  
  const { data = {}, errors = [] } = await execute({ document, schema: component.schema, rootValue, contextValue, variableValues });
  
  if (errors.length > 0) {
    for (const error of errors) {
      deepSet(data, error.path, error);
    }
  }

  let result = {};

  //do not count current field resolver in path since that will exist in data result
  deepSet(result, rootPath.length > 1 ? rootPath.slice(0, rootPath.length - 1) : rootPath, data);
  
  while (fieldPath.length > 0) {
    let path = fieldPath.shift();
    result = result[fieldMap[path] || path];
  }
  
  return result;
};

module.exports = { delegateToComponent };