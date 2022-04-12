const {
  isUnionType, 
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  getNamedType
} = require('graphql');

const { mapSchema, MapperKind } = require('@graphql-tools/utils');

/**
 * Prunes the provided schema, removing unused and empty types
 * @param schema The schema to prune
 * @param options Additional options for removing unused types from the schema
 */
 function pruneSchema(schema, options = {}) {
  const {
    skipEmptyCompositeTypePruning,
    skipEmptyUnionPruning,
    skipPruning,
    skipUnimplementedInterfacesPruning,
    skipUnusedTypesPruning,
  } = options;
  let prunedTypes = []; // Pruned types during mapping
  let prunedSchema = schema;

  do {
    let visited = visitSchema(prunedSchema);

    //Custom pruning  was defined, so we need to pre-emptively revisit the schema accounting for this
    if (skipPruning) {
      const revisit = [];

      for (const typeName in prunedSchema.getTypeMap()) {
        if (typeName.startsWith('__')) {
          continue;
        }

        const type = prunedSchema.getType(typeName);

        //if we want to skip pruning for this type, add it to the list of types to revisit
        if (type && skipPruning(type)) {
          revisit.push(typeName);
        }
      }

      visited = visitQueue(revisit, prunedSchema, visited); //visit again
    }

    prunedTypes = [];

    prunedSchema = mapSchema(prunedSchema, {
      [MapperKind.TYPE]: type => {
        if (!visited.has(type.name) && !isSpecifiedScalarType(type)) {
          if (
            isUnionType(type) ||
            isInputObjectType(type) ||
            isInterfaceType(type) ||
            isObjectType(type) ||
            isScalarType(type)
          ) {
            // skipUnusedTypesPruning: skip pruning unused types
            if (skipUnusedTypesPruning) {
              return type;
            }
            // skipEmptyUnionPruning: skip pruning empty unions
            if (isUnionType(type) && skipEmptyUnionPruning && !Object.keys(type.getTypes()).length) {
              return type;
            }
            if (isInputObjectType(type) || isInterfaceType(type) || isObjectType(type)) {
              // skipEmptyCompositeTypePruning: skip pruning object types or interfaces with no fields
              if (skipEmptyCompositeTypePruning && !Object.keys(type.getFields()).length) {
                return type;
              }
            }
            // skipUnimplementedInterfacesPruning: skip pruning interfaces that are not implemented by any other types
            if (isInterfaceType(type) && skipUnimplementedInterfacesPruning) {
              return type;
            }
          }

          prunedTypes.push(type.name);
          visited.delete(type.name);

          return null;
        }
        return type;
      },
    });
  } while (prunedTypes.length); // Might have empty types and need to prune again

  return prunedSchema;
}

function visitSchema(schema) {
  const queue = []; // queue of nodes to visit

  const isRootType = typeName => ['Query', 'Mutation', 'Subscripton'].indexOf(typeName) > -1;
  
  //Grab the root types and start there
  for (const typeName in schema.getTypeMap()) {
    if (isRootType(typeName)) {
      queue.push(typeName);
    }
  }

  return visitQueue(queue, schema);
}

function visitQueue(queue, schema, visited = new Set()) {
  // Navigate all types starting with pre-queued types (root types)
  while (queue.length) {
    const typeName = queue.pop();

    //Skip types we already visited
    if (visited.has(typeName)) {
      continue;
    }

    const type = schema.getType(typeName);

    if (type) {
      // Get types for union
      if (isUnionType(type)) {
        queue.push(...type.getTypes().map(type => type.name));
      }

      // If the type has files visit those field types
      if ('getFields' in type) {
        const fields = type.getFields();
        const entries = Object.entries(fields);

        if (!entries.length) {
          continue;
        }

        for (const [, field] of entries) {
          if (isInputObjectType(type)) {
            for (const arg of field.args) {
              queue.push(getNamedType(arg.type).name); // Visit arg types
            }
          }

          queue.push(getNamedType(field.type).name);
        }
      }

      // Visit interfaces this type is implementing if they haven't been visited yet
      if ('getInterfaces' in type) {
        queue.push(...type.getInterfaces().map(iface => iface.name));
      }

      visited.add(typeName); //Mark as visited (and therefore it is used and should be kept)
    }
  }
  return visited;
}

module.exports = { pruneSchema };