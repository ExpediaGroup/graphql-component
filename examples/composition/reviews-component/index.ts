'use strict';

import { types } from "./types";
import GraphQLComponent from "../../../src";
import { resolvers } from "./resolvers";
import ReviewsDataSource from "./datasource";

export default class ReviewsComponent extends GraphQLComponent {
  constructor({ dataSources = [new ReviewsDataSource()], ...options } = {}) {
    super({ types, resolvers, dataSources, ...options });
  }
}
