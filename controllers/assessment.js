'use strict';
const request = require('request');
const Promise = require('bluebird');
const tmpDB = require('nano')('http://localhost:5984/tmp_tangerine');


exports.get = (req, res) => {
  res.send('In Assessment Route');
}
