
const { GraphQLExtension } = require('graphql-extensions');
const debug = require('debug')('graphql-component:tracer');

const queries = new WeakMap();

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
};

const logResolverErrors = function (qs, errors) {
  if (!errors) {
    return;
  }
  console.log(errors);
}

class TraceExtension extends GraphQLExtension {
  constructor() {
    super();
  }

  requestDidStart({ context, queryString }) {
    queries.set(context, queryString);
  }

  willSendResponse({ context, graphqlResponse: { errors, extensions: { tracing } = {} } }) {
    const qs = queries.get(context);

    //logResolverTimings(tracing);
    logResolverErrors(qs, errors);
    debug('sending response');
  }
}

module.exports = TraceExtension;

