'use strict';

const propertiesDB = {
  1: { id: 1, geo: ['41.40338', '2.17403']},
  2: { id: 2, geo: ['111.1111', '222.2222']}
}

class PropertyDataSource {
  getPropertyById(context, id) {
    return propertiesDB[id];
  }
}

module.exports = PropertyDataSource;