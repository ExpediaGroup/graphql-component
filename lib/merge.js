
const mergeResolvers = function (resolvers = {}, merge = {}) {
  const merged = Object.assign({}, resolvers);

  for (const [type, defs] of Object.entries(merge)) {
    if (!merged[type]) {
      merged[type] = {};
    }
    for (const [name, value] of Object.entries(defs)) {
      merged[type][name] = value;
    }
  }

  return merged;
};

module.exports = { mergeResolvers };