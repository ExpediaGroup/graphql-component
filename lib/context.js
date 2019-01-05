
const debug = require('debug')('graphql-component:context');

const builder = function (component, { namespace, factory }) {
  return async function (request) {
    const ctx = {};

    for (const imp of component._imports) {
      Object.assign(ctx, await imp._context(request));
    }

    if (typeof factory === 'function') {
      debug(`building ${namespace} context`);
      ctx[namespace] = await factory.call(component, request);
    }

    return ctx;
  };
};

module.exports = { builder };