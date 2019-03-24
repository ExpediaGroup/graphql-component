'use strict';

const Casual = require('casual');

const mocks = (importedMocks) => {
  return {
    Property: () => ({
      id: Casual.uuid,
      geo: [`${Casual.latitude}`, `${Casual.longitude}`]
    })
  }
};

module.exports = mocks;
