'use strict';

import { ComponentContext, DataSourceDefinition } from "../../../src";

interface Property {
  id: number;
  geo: string[];
}

const propertiesDB: Record<number, Property> = {
  1: { id: 1, geo: ['41.40338', '2.17403']},
  2: { id: 2, geo: ['111.1111', '222.2222']}
}

class PropertyDataSource implements DataSourceDefinition<PropertyDataSource> {
  name = 'PropertyDataSource';

  getPropertyById(context: ComponentContext, id: string): Property | undefined {
    return propertiesDB[id];
  }
}

export default PropertyDataSource; 