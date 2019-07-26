'use strict';

const mergeDirectives = function (directives = []) {
  return Object.assign({}, ...directives);
};

const getImportedDirectives = function (component) {
  return Object.assign({}, component._directives, ...component._importedDirectives);
};

const namespaceDirectivesInTypeDefs = (types = [], id) => {
  const regex = /(@[a-zA-Z0-9]*)\b/g;
  return types.map(t => t.replace(regex, `$1_${id}`));
};

const namespaceDirectiveDefs = (directives = {}, id) => {
  if (directives) {
    const namespaced = {};
    Object.keys(directives).forEach(function (key) {
      namespaced[`${key}_${id}`] = directives[key];
    });
    return namespaced;
  }
  return directives;
};

module.exports = { mergeDirectives, getImportedDirectives, namespaceDirectivesInTypeDefs, namespaceDirectiveDefs };
