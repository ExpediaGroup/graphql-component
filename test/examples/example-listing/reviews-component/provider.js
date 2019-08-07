'use strict';

class ReviewsProvider {
  getReviewsByPropertyId(context, propertyId) {
    return [{
      id: 1,
      propertyId: 1,
      content: 'content for review'
    }];
  }
};

module.exports = ReviewsProvider;