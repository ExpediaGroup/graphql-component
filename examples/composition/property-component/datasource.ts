import { DataSourceDefinition, ComponentContext } from '../../../src';

const propertiesDB = {
  1: { id: 1, geo: ['41.40338', '2.17403']},
  2: { id: 2, geo: ['111.1111', '222.2222']}
}

export default class PropertyDataSource implements DataSourceDefinition<PropertyDataSource> {
  name = 'PropertyDataSource';

  getPropertyById(context: ComponentContext, id: string) {
    return propertiesDB[id];
  }
}