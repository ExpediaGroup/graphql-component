'use strict';

const debug = require('debug')('graphql-component:context');

const intercept = function (instance, context) {
  debug(`intercepting ${instance.constructor.name}`);

  return new Proxy(instance, {
    get(target, key) {
      const original = target[key];

      return function (...args) {
        return original(context, ...args);
      };
    }
  });

};

const createProviderInjection = function (component) {

  return function (context) {
    for (const imp of component.imports) {
      imp._providerInjection(context);
    }

    if (component.provider) {
      debug(`setting provider ${component.provider.constructor.name}`);

      context.providers.set(component.provider.constructor, intercept(component.provider, context));
    }
  };

};

module.exports = { intercept, createProviderInjection };