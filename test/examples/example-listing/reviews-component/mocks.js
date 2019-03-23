
const Casual = require('casual');

const mocks = (importedMocks) => {
  return {
    Review: () => ({
      id: Casual.uuid, 
      propertyId: Casual.uuid, 
      content: Casual.description
    })
  };
};

module.exports = mocks;