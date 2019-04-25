'use strict';

const debug = require('debug')('graphql-component:context');

const contextBuilder = function (component, ctxConfig) {
  return async function (arg) {
    const ctx = {};

    for (const imp of component.imports) {
      Object.assign(ctx, await imp.context(arg));
    }

    if (ctxConfig) {
      debug(`building ${ctxConfig.namespace} context`);

      if (!ctx[ctxConfig.namespace]) {
        ctx[ctxConfig.namespace] = {};
      }

      Object.assign(ctx[ctxConfig.namespace], await ctxConfig.factory.call(component, arg)); 
    }

    return ctx;
  };
};

const createContext = function (context) {
  const middleware = [];

  const creator = async function (arg) {
    debug('building root context');

    for (let { name, fn } of middleware) {
      debug(`applying ${name} middleware`);
      arg = await fn(arg);
    }

    const ctx = await context(arg);

    return {
      ...arg,
      ...ctx
    };
  };

  creator.use = function (name, fn) {
    if (typeof name === 'function') {
      fn = name;
      name = 'unknown';
    }
    debug(`adding ${name} middleware`);
    middleware.push({ name, fn });
  };

  return creator;
};

module.exports = { contextBuilder, createContext };