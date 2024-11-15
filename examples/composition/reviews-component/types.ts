'use strict';

import fs from 'fs';
import path from 'path';

export const types = fs.readFileSync(path.resolve(path.join(__dirname, 'schema.graphql')), 'utf-8');

