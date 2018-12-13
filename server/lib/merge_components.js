'use strict';

const { mergeSchemas } = require('graphql-tools');

function mergeComponentSchemas(components) {
    const schemas = [];

    for (const component of components) {
        schemas.push(component.schema);
    }

    const mergedSchema = mergeSchemas({
        schemas
    });
    
    return { schema: mergedSchema };
};

module.exports = { mergeComponentSchemas };
