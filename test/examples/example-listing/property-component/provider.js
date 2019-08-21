'use strict';

class PropertyProvider {
  get name() {
    return 'PropertyProvider';
  }
  getPropertyById(context, id) {
    return {
      id,
      geo: ['41.40338', '2.17403']
    };
  }
};

module.exports = PropertyProvider;