import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";
import { defaultFieldResolver, GraphQLSchema } from "graphql";

function toUppercaseDirective(directiveName: string) {
    return (schema: GraphQLSchema) => mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const upperDirective = getDirective(schema, fieldConfig, directiveName)?.[0];
            if (upperDirective) {
                const {resolve = defaultFieldResolver} = fieldConfig;
                return {
                    ...fieldConfig,
                    resolve: async function (source: any, args: any, context: any, info: any) {
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

export default toUppercaseDirective; 