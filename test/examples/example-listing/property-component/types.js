'use strict';

const Fs = require('fs');
const Path = require('path');

const types = Fs.readFileSync(Path.resolve(Path.join(__dirname, 'schema.graphql')), 'utf-8');

module.exports = types;
