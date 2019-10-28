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
        return original.call(instance, context, ...args);
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
      debug(`overriding datasource ${override.constructor.name}`);
      dataSources[override.constructor.name] = intercept(override, context);
    }
    
    if (component.dataSources && component.dataSources.length > 0) {
      for (const dataSource of component.dataSources) {
        const name = dataSource.constructor.name;
        if (!dataSources[name]) {
          dataSources[name] = intercept(dataSource, context);
        }
      }
    }

    return dataSources;
  };

};

module.exports = { intercept, createDataSourceInjection };