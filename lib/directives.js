'use strict';

const mergeDirectives = function (directives = []) {
  return Object.assign({}, ...directives);
};

const getImportedDirectives = function (component) {
  const directives = Object.entries(component._directives || {}).reduce((directives, [key, value]) => {
    directives[`${key}_${component._id}`] = value;
    return directives;
  }, {});
  return Object.assign({}, directives, ...component._importedDirectives);
};

module.exports = { mergeDirectives, getImportedDirectives };
