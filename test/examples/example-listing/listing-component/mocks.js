'use strict';

const casual = require('casual');

const mocks = (importedMocks) => {
  return {
    Listing: () => ({
      id: casual.uuid,
      geo: importedMocks.Property().geo,
      reviews: [
        importedMocks.Review(),
        importedMocks.Review()
      ]
    })
  };
};

module.exports = mocks;
