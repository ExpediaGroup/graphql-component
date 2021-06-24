const startReviewsService = require('./reviews-service');
const startPropertyService = require('./property-service');
const startGateway = require('./gateway');

const start = async () => {
  await startReviewsService();
  await startPropertyService();
  await startGateway();
}

start();