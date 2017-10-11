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
const nano = require('nano');

/**
 * Create Express Server.
 */

const app = express();

/**
 * Express configuration.
 */

app.set('port', 5555);
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
app.post('/assessment/headers/all', assessmentController.generateAll);
app.post('/assessment/headers/:id', assessmentController.generateHeader);

app.post('/result', resultController.all);
app.post('/assessment/result/all', resultController.processAll);
app.post('/assessment/result/:id', resultController.processResult);

app.post('/workflow', workflowController.all);
app.post('/workflow/headers/all', workflowController.generateAll);
app.post('/workflow/headers/:id', workflowController.generateHeader);

app.post('/workflow/result/all', tripController.processAll);
app.post('/workflow/result/:id', tripController.processResult);

app.post('/generate_csv', csvController.generate);
app.post('/tangerine_changes', changesController.changes);

/**
 * Hook processing function to couchDB changes feed.
 */

const dbConfig = require('./config');
const processChangedDocument = require('./controllers/changes').processChangedDocument;

const BASE_DB = nano(dbConfig.base_db);
const feed = BASE_DB.follow({ since: 'now', include_docs: true });

feed.on('change', async(resp) => {
  processChangedDocument(resp, dbConfig.base_db, dbConfig.result_db);
});

feed.on('error', (err) => Error(err));
feed.follow();


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
