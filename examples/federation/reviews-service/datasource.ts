'use strict';

import { ComponentContext, DataSourceDefinition } from "../../../src";

interface Review {
  id: string;
  content: string;
}

// reviews indexed by property id
const reviewsDB: Record<number, Review[]> = {
  1: [ { id: 'rev-id-1-a', content: 'this property was great'}, { id: 'rev-id-1-b', content: 'this property was terrible'}],
  2: [ { id: 'rev-id-2-a', content: 'This property was amazing for our extended family'}, { id: 'rev-id-2-b', content: 'I loved the proximity to the beach'}, { id: 'rev-id-2-c', content: 'The bed was not comfortable at all'}]
}

class ReviewsDataSource implements DataSourceDefinition<ReviewsDataSource> {
  getReviewsByPropertyId(context: ComponentContext, propertyId: string): Review[] | undefined {
    return reviewsDB[propertyId];
  }
}

export default ReviewsDataSource; 