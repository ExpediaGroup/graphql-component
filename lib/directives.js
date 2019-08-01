'use strict';

const debug = require('debug')('graphql-component:directives');

const mergeDirectives = function (directives = []) {
  return Object.assign({}, ...directives);
};

const getImportedDirectives = function (parent, component) {
  const parentDirectives = parent._directives || {};
  const directives = Object.entries(component._directives || {}).reduce((directives, [key, value]) => {
    if (parentDirectives[key]) {
      debug(`renaming conflicting ${key} directive as ${key}_${component._id}`);
      directives[`${key}_${component._id}`] = value;
    }
    else {
      directives[key] = value;
    }
    return directives;
  }, {});
  return Object.assign({}, directives, ...component._importedDirectives);
};

module.exports = { mergeDirectives, getImportedDirectives };
