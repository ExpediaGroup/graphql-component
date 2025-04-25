'use strict';

import * as fs from 'fs';
import * as path from 'path';

const types = fs.readFileSync(path.resolve(path.join(__dirname, 'schema.graphql')), 'utf-8');

export default types; 