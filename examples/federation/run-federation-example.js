const { run: runReviewsService } = require('./reviews-service');
const { run: runPropertyService } = require('./property-service');
const { run: runGateway } = require('./gateway');

const start = async () => {
  await runReviewsService();
  await runPropertyService();
  await runGateway();
}

start();