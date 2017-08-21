// Module dependencies.
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');

// Create Express server.
const app = express();

// Express configuration
app.set('port', 8888);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Controllers (route handlers).
const assessmentController = require('./controllers/assessment');
const resultController = require('./controllers/result');
const workflowController = require('./controllers/workflow');
const csvController = require('./controllers/generate_csv');
const changesController = require('./controllers/changes');
const tripController = require('./controllers/trip');

// Primary app routes
app.post('/assessment', assessmentController.all);
app.post('/assessment/:id', assessmentController.get);
app.post('/result', resultController.all);
app.post('/result/:id', resultController.get);
app.post('/workflow', workflowController.all);
app.post('/workflow/headers/:id', workflowController.getHeaders);
app.post('/generate_csv/:id', csvController.generate);
app.post('/tangerine_changes', changesController.changes);
app.post('/workflow/result/:id', tripController.getResults);

// Error Handler
app.use(errorHandler());

// Start Express server.
app.listen(app.get('port'), () => {
  console.log('%s Tangerine Reporting server listening on port %d.', chalk.green('✓'), app.get('port'));
});

module.exports = app;
