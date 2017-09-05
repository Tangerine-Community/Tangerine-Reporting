/**
 * Main App Entry Point.
 */

/**
 * Module dependencies.
 */
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');

/**
 * Create Express Server.
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
 * Controllers or route handlers.
 */
const assessmentController = require('./controllers/assessment');
const resultController = require('./controllers/result');
const workflowController = require('./controllers/workflow');
const csvController = require('./controllers/generate_csv');
const changesController = require('./controllers/changes');
const tripController = require('./controllers/trip');

/**
 * App routes.
 */
app.post('/assessment', assessmentController.all);
app.post('/result', resultController.all);

app.post('/assessment/headers/_all', assessmentController.generateAll);
app.post('/assessment/headers/:id', assessmentController.get);

app.post('/assessment/result/_all', resultController.generateAll);
app.post('/assessment/result/:id', resultController.get);

app.post('/workflow', workflowController.all);
app.post('/workflow/headers/:id', workflowController.getHeaders);
app.post('/workflow/result/:id', tripController.getResults);

app.post('/generate_csv', csvController.generate);
app.post('/tangerine_changes', changesController.changes);

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
