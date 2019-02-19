
const fixtures = {
  Query: {
    property(_, { id }) {
      return { id: id, geo: ['41.40338', '2.17403'] };
    }
  }
};

module.exports = fixtures;