'use strict';

const debug = require('debug')('graphql-component:provider');

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

const createProviderInjection = function (component, providerOverrides = []) {
  return function (context = {}) {
    const providers = {};

    for (const imp of component.imports) {
      Object.assign(providers, imp._providerInjection(context));
    }

    for (const override of providerOverrides) {
      debug(`overriding provider ${override.name}`);
      providers[override.name] = intercept(override, context);
    }

    if (component.provider && !providers[component.provider.name]) {
      providers[component.provider.name] = intercept(component.provider, context);
    }

    return providers;
  };

};

module.exports = { intercept, createProviderInjection };