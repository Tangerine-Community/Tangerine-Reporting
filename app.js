/**
 * Module dependencies.
 */
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');

/**
 * Controllers (route handlers).
 */
const assessmentController = require('./controllers/assessment');

/**
 * Create Express server.
 */
const app = express();


/**
 * Connect to CouchDB.
 */
const couch = require('nano')('http://localhost:5984');
const TMP_TANGERINEDB = couch.db.use('tmp_tangerine');

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
