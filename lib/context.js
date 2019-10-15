'use strict';

const debug = require('debug')('graphql-component:context');

const createContext = function (component, ctxConfig) {
  return async function (context) {
    const ctx = {};

    for (const imp of component.imports) {
      Object.assign(ctx, await imp._context(context));
    }

    if (ctxConfig) {
      debug(`building ${ctxConfig.namespace} context`);

      if (!ctx[ctxConfig.namespace]) {
        ctx[ctxConfig.namespace] = {};
      }

      Object.assign(ctx[ctxConfig.namespace], await ctxConfig.factory.call(component, context));
    }

    return ctx;
  };
};

const wrapContext = function (component) {
  const middleware = [];
  const contextFunction = component._context;
  const dataSourceInject = component._dataSourceInjection;

  const context = async function (context) {
    debug(`building ${component._id} root context`);

    for (let { name, fn } of middleware) {
      debug(`applying ${name} middleware`);
      context = await fn(context);
    }

    const componentContext = await contextFunction(context);

    const globalContext = {
      ...context,
      ...componentContext
    };
    
    globalContext.dataSources = dataSourceInject(globalContext);
    
    return globalContext;
  };

  context.use = function (name, fn) {
    if (typeof name === 'function') {
      fn = name;
      name = 'unknown';
    }
    debug(`adding ${name} middleware`);
    middleware.push({ name, fn });
  };

  return context;
};

module.exports = { createContext, wrapContext };