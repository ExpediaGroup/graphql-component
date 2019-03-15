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

module.exports = { builder };