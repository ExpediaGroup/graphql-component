
const { GraphQLExtension } = require('graphql-extensions');
const debug = require('debug')('graphql-component:tracer');

const logResolverTimings = function (tracing) {
  if (!tracing) {
    return;
  }
  
  const startTime = new Date(tracing.startTime).getTime();
  const endTime = new Date(tracing.endTime).getTime();

  tracing.execution.resolvers.forEach(resolver => {
    const start = startTime + (resolver.startOffset * 1000000);
    const end = start - (resolver.duration);
  });
}

class TraceExtension extends GraphQLExtension {
  constructor() {
    super();
  }

  willSendResponse({ context, graphqlResponse: { errors, extensions: { tracing } = {} } }) {
    logResolverTimings(tracing);
    //logResolverErrors(errors);
    debug('sending response');
  }
}

module.exports = TraceExtension;

