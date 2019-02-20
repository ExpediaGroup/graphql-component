
const { GraphQLExtension } = require('graphql-extensions');
const Tracer = require('./tracer');
const debug = require('debug')('graphql-component:tracer');

const tracer = new Tracer('graphql');
const traces = new WeakMap();

class TraceExtension extends GraphQLExtension {
  constructor() {
    super();
  }

  requestDidStart({ operationName, context }) {
    debug(`request begin operationName=${operationName}`);
    const trace = tracer.createTrace();
    traces.set(context, trace);
    trace.timeBegin('GraphQL.request');
  }

  executionDidStart({ executionArgs }) {
    debug('execution start');
    const trace = traces.get(executionArgs.contextValue);
    if (trace) {
      trace.timeBegin('GraphQL.execution');
    }
  }

  willSendResponse({ context }) {
    debug('sending response');
    const trace = traces.get(context);
    if (trace) {
      trace.timeEnd('GraphQL.execution');
      trace.timeEnd('GraphQL.request');
    }
  }
}

module.exports = TraceExtension;
