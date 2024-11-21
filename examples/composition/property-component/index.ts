'use strict';

import { types } from "./types";
import GraphQLComponent from "../../../src";
import { resolvers } from "./resolvers";
import PropertyDataSource from "./datasource";

export default class PropertyComponent extends GraphQLComponent {
  constructor({ dataSources = [new PropertyDataSource()], ...options } = {}) {
    super({ types, resolvers, dataSources, ...options });
  }
}

