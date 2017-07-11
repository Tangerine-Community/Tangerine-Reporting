'use strict';
const request = require('request');
const Promise = require('bluebird');
const couch = require('nano')('http://localhost:5984');
const TMP_DB = couch.db.use('tmp_tangerine');


exports.get = (req, res) => {
  console.log('in assessment');
    res.send('In Assessment Route');

}
