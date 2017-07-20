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
const Excel = require('exceljs');

/**
 * Create Express server.
 */
const app = express();

/**
 * Express configuration.
 */
app.set('port', 8888);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/**
 * Controllers (route handlers).
 */
const assessmentController = require('./controllers/assessment');

/**
 * Primary app routes
 */

app.get('/', function(req, res) {
  res.send('\n Welcome to Tangerine Reporting Service ');
});

app.get('/assessment', assessmentController.getAll);
// app.get('/assessment/:id', assessmentController.getAssessment);
// app.get('/assessment/results', assessmentController.getResults);
// app.get('/assessment/questions', assessmentController.getQuestions);
// app.get('/assessment/subtests', assessmentController.getSubtests);


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
