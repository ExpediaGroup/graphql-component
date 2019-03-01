
const Casual = require('casual');

const mocks = {
  Property: () => ({
    id: 1,
    geo: [`${Casual.latitude}`, `${Casual.longitude}`]
  })
};

module.exports = mocks;