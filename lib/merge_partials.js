'use strict';

const { mergeSchemas } = require('graphql-tools');

function mergePartialsSchemas(partials) {
    const schemas = [];

    for (const partial of partials) {
        schemas.push(partial.schema);
    }

    const mergedSchema = mergeSchemas({
        schemas
    });
    
    return { schema: mergedSchema };
};

module.exports = { mergePartialsSchemas };
