'use strict';

const mergeDirectives = function (directives = []) {
  return Object.assign({}, ...directives);
};

const getImportedDirectives = function (component) {
  return Object.assign({}, component._directives, ...component._importedDirectives);
};

module.exports = { mergeDirectives, getImportedDirectives };
