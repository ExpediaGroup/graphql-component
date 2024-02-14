const {getDirective, MapperKind, mapSchema} = require("@graphql-tools/utils");
const {defaultFieldResolver} = require("graphql");

function toUppercaseDirective(directiveName) {
    return (schema) => mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const upperDirective = getDirective(schema, fieldConfig, directiveName)?.[0];
            if (upperDirective) {
                const {resolve = defaultFieldResolver} = fieldConfig;
                return {
                    ...fieldConfig,
                    resolve: async function (source, args, context, info) {
                        const result = await resolve(source, args, context, info);
                        if (typeof result === 'string') {
                            return result.toUpperCase();
                        }
                        return result;
                    }
                }
            }
        }
    })
}

module.exports = toUppercaseDirective