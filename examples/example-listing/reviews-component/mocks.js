
const Casual = require('casual');

const mocks = {
  Review: () => ({
    id: 1, 
    propertyId: 1, 
    content: Casual.description
  })
};

module.exports = mocks;