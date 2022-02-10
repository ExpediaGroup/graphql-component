'use strict';

// reviews indexed by property id
const reviewsDB = {
  1: [ { id: 'rev-id-1-a', content: 'this property was great'}, { id: 'rev-id-1-b', content: 'this property was terrible'}],
  2: [ { id: 'rev-id-2-a', content: 'This property was amazing for our extended family'}, { id: 'rev-id-2-b', content: 'I loved the proximity to the beach'}, { id: 'rev-id-2-c', content: 'The bed was not comfortable at all'}]
}

class ReviewsDataSource {
  getReviewsByPropertyId(context, propertyId) {
    return reviewsDB[propertyId];
  }
}

module.exports = ReviewsDataSource;