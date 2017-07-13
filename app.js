/**
 * Module dependencies.
 */
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');
const _ = require('lodash');
const Promise = require('bluebird');

/**
 * Controllers (route handlers).
 */
const assessmentController = require('./controllers/assessment');

/**
 * Create Express server.
 */
const app = express();


/**
 * Connect to nanoDB.
 */
const nano = require('nano');

// Using nano-promises library
// const prom = require('nano-promises');
// const TMP_TANGERINEDB = prom(nano('http://localhost:5984')).use('tmp_tangerine');

// Using nano only
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
// const TMP_TANGERINEDB = nano('http://localhost:5984').use('tmp_tangerine');
// Promise.promisifyAll(TMP_TANGERINEDB);


/**
 * Express configuration.
 */
app.set('port', 8888);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/**
 * API routes.
 */
app.get('/', function(req, res) {
  var columnData;
  var allDB = [];
  let columnHeaders;

  // get a specific document
  // TMP_TANGERINEDB
  //  .get('0095F1B5-7A1D-7B1F-AC59-D2AF2FC05BFD', (err, body) => {
  //     if (err) {
  //        res.send(err);
  //     }
  //    columnHeaders = _.keysIn(body);
  //    columnData = body;
  //    res.json({ columnHeaders, columnData })
  // });

  TMP_TANGERINEDB.list({ include_docs: true }, (err, body) => {
      if (err) return res.send(err);

      // Get a single result collection document
      let first  = _.find(body.rows, (data) => { return data.doc.collection === 'result'; });

      // Get the keys for a result document. To be used as excel column headers
      columnHeaders = _.keysIn(first.doc);

      // Get all collections that are result
      let resultCollections = _.filter(body.rows, (data) => data.doc.collection === 'result');

      // Return just 10 documents of the data
      res.json({ columnHeaders, results: resultCollections.slice(90, 100) })
    })


});

app.get('/api/v1/assessment', assessmentController.get);

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('%s Tangerine Reporting server listening on port %d.', chalk.green('✓'), app.get('port'));
});

module.exports = app;
