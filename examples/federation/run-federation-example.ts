import { run as runReviewsService } from './reviews-service';
import { run as runPropertyService } from './property-service';
import { run as runGateway } from './gateway';

const start = async (): Promise<void> => {
  await runReviewsService();
  await runPropertyService();
  await runGateway();
}

start(); 