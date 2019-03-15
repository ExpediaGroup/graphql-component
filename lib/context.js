'use strict';

const debug = require('debug')('graphql-component:context');

const builder = function (component, { namespace, factory }) {
  return async function (arg) {
    const ctx = {};

    for (const imp of component._imports) {
      Object.assign(ctx, await imp._context(arg));
    }

    if (typeof factory === 'function') {
      debug(`building ${namespace} context`);
      ctx[namespace] = await factory.call(component, arg);
    }

    return ctx;
  };
};

const create = function (context) {
  const middleware = [];

  const createContext = async (arg) => {
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

  createContext.use = (name, fn) => {
    if (typeof name === 'function') {
      fn = name;
      name = 'unknown';
    }
    debug(`adding ${name} middleware`);
    middleware.push({ name, fn });
  };

  return createContext;
};

module.exports = { builder, create };