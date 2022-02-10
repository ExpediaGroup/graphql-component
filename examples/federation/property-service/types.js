'use strict';

const fs = require('fs');
const path = require('path');

const types = fs.readFileSync(path.resolve(path.join(__dirname, 'schema.graphql')), 'utf-8');

module.exports = types;