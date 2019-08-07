'use strict';

const intercept = function (instance, context) {

  return new Proxy(instance, {
    get(target, key) {
      const original = target[key];

      return function (...args) {
        return original(context, ...args);
      };
    }
  });

};

module.exports = { intercept };