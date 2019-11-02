'use strict';

class ReviewsDataSource {
  getReviewsByPropertyId(context, propertyId) {
    return [{
      id: 1,
      propertyId: 1,
      content: 'content for review'
    }];
  }
};

module.exports = ReviewsDataSource;