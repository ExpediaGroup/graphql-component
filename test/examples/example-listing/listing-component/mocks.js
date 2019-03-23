
const Casual = require('casual');

const mocks = (importedMocks) => {
  return {
    Listing: () => ({
      id: Casual.uuid,
      geo: importedMocks.Property().geo,
      reviews: [
        importedMocks.Review(),
        importedMocks.Review()
      ]
    })
  }
};

module.exports = mocks;