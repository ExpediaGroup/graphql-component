'use strict';

const debug = require('debug')('graphql-component:dataSource');

const intercept = function (instance, context) {
  debug(`intercepting ${instance.constructor.name}`);

  return new Proxy(instance, {
    get(target, key) {
      if (typeof target[key] !== 'function' || key === instance.constructor.name) {
        return target[key];
      }
      const original = target[key];
      
      return function (...args) {
        return original(context, ...args);
      };
    }
  });

};

const createDataSourceInjection = function (component, dataSourceOverrides = []) {
  return function (context = {}) {
    const dataSources = {};

    for (const imp of component.imports) {
      Object.assign(dataSources, imp._dataSourceInjection(context));
    }

    for (const override of dataSourceOverrides) {
      debug(`overriding datasource ${override.name}`);
      dataSources[override.name] = intercept(override, context);
    }
    
    if (component.dataSource && !dataSources[component.dataSource.name]) {
      dataSources[component.dataSource.name] = intercept(component.dataSource, context);
    }

    return dataSources;
  };

};

module.exports = { intercept, createDataSourceInjection };