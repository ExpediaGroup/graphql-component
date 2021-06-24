'use strict';

class ReviewsDataSource {
  getReviewsByPropertyId(context, propertyId) {
    return [{
      id: 'rev-id-1',
      content: 'content for review'
    }];
  }
};

module.exports = ReviewsDataSource;