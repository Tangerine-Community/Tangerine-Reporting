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

// Primary app routes
app.get('/assessment', assessmentController.all);
app.get('/assessment/:id', assessmentController.get);
app.get('/result', resultController.all);
app.get('/result/:id', resultController.get);
app.get('/workflow', workflowController.all);
app.get('/workflow/:id', workflowController.get);
app.get('/generate/:id', csvController.generate);

// Error Handler
app.use(errorHandler());

// Start Express server.
app.listen(app.get('port'), () => {
  console.log('%s Tangerine Reporting server listening on port %d.', chalk.green('✓'), app.get('port'));
});

module.exports = app;
