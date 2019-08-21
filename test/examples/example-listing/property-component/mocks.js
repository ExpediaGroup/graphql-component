'use strict';

const casual = require('casual');

const mocks = (importedMocks) => {
  return {
    Property: () => ({
      id: casual.uuid,
      geo: [`${casual.latitude}`, `${casual.longitude}`]
    })
  }
};

module.exports = mocks;
