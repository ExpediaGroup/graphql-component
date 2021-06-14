'use strict';

const { FilterTypes, FilterObjectFields } = require('graphql-tools');

const exclusions = function(exclusions) {
  return exclusions.map((exclusion) => {
    if (typeof exclusion === 'string') {
      const parts = exclusion.split('.');
      let type;
      let field;
      if (parts.length === 1) {
        type = parts[0];
      }
      else if (parts.length === 2) {
        type = parts[0];
        field = parts[1];
      }
      else {
        throw new Error(`'${exclusion}' is malformed, should be of form 'type[.[field]]'`)
      }

      // specific type/field exclusion such as 'Query.foo'
      if (type && field && field !== '*') {
        return new FilterObjectFields((typeName, fieldName) => {
          if (typeName === type && field === fieldName) {
            return false;
          }
          return true;
        })
      }
      // type only exclusion (such as 'Query') or type and all fields exclusions (such as 'Query.*')
      else if (type && !field || (type && field && field === '*')) {
        return new FilterTypes(graphqlObjectType => {
          if (graphqlObjectType.name === type) {
            return false;
          }
          return true;
        })
      }
    // assume that someone passed in a valid graphql-tools transform
    } else if (typeof exclusion === 'object') {
      return exclusion;
    }
  });
}

module.exports = { exclusions };