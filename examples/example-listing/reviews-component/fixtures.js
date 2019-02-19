
const fixtures = {
  Query: {
    reviewsByPropertyId(_, { propertyId }) {
      return [{ id: 1, propertyId, content: 'id 1 content' }, { id: 2, propertyId, content: 'id 2 content' }];
    }
  }
};

module.exports = fixtures;