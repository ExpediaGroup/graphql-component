'use strict';

class ReviewsDataSource {
  get name() {
    return 'ReviewsDataSource';
  }
  getReviewsByPropertyId(context, propertyId) {
    return [{
      id: 1,
      propertyId: 1,
      content: 'content for review'
    }];
  }
};

module.exports = ReviewsDataSource;