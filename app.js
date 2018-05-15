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
app.use(express.static(__dirname + '/public'));

/**
 * Controllers.
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

app.get('/', (req, res) => res.send('index'));

app.post('/download_csv', (req, res) => {
  const resultDbUrl =  dbConfig.resultDb;
  const resultId = req.body.workflowId;
  const resultYear = req.body.year;
  let resultMonth = req.body.month;
  resultMonth = resultMonth ? resultMonth : false;

  let queryId = resultMonth && resultYear ? `${resultId}_${resultYear}_${resultMonth}` : resultId;

  dbQuery.retrieveDoc(resultId, resultDbUrl)
    .then(async docHeaders => {
      const result = await dbQuery.getProcessedResults(queryId, resultDbUrl);
      generateCSV(docHeaders, result, res);
    })
    .catch(err => res.send(err));

});

/**
 * Hook data processing function to couchDB changes feed.
 */

const dbConfig = require('./config');
const dbQuery = require('./utils/dbQuery');
const processChangedDocument = require('./controllers/changes').processChangedDocument;
const generateCSV = require('./controllers/generate_csv').generateCSV;

const BASE_DB = nano(dbConfig.baseDb);
const feed = BASE_DB.follow({ since: 'now', include_docs: true });

feed.on('change', (resp) => {
  feed.pause();
  processChangedDocument(resp, dbConfig.baseDb, dbConfig.resultDb);
  setTimeout(function() { feed.resume() }, 500);
});

feed.on('error', (err) => err);
feed.follow();

/**
 * App routes.
 */

app.get('/', (req, res) => res.render('index'));

app.post('/download_csv', (req, res) => {
  const resultDbUrl =  dbConfig.resultDb;
  const resultId = req.body.workflowId;
  const resultYear = req.body.year;
  let resultMonth = req.body.month;
  resultMonth = resultMonth ? resultMonth : false;

  let queryId = resultMonth && resultYear ? `${resultId}_${resultYear}_${resultMonth}` : resultId;

  dbQuery.retrieveDoc(resultId, resultDbUrl)
    .then(async docHeaders => {
      const result = await dbQuery.getProcessedResults(queryId, resultDbUrl);
      generateCSV(docHeaders, result, res);
    })
    .catch(err => res.send(err));

});

// collection routes
app.post('/assessment', assessmentController.all);
app.post('/workflow', workflowController.all);
app.post('/result', resultController.all);

// generate all headers routes at once
app.post('/assessment/headers/all', assessmentController.generateAll);
app.post('/workflow/headers/all', workflowController.generateAll);

// generate headers routes
app.post('/assessment/headers/:id', assessmentController.generateHeader);
app.post('/workflow/headers/:id', workflowController.generateHeader);

// process result routes
app.post('/assessment/result/:id', resultController.processResult);
app.post('/workflow/result/:id', tripController.processResult);

app.get('/generate_csv/:id/:db_name/:year?/:month?', csvController.generate);
app.post('/generate_csv/:id/:db_name/:year?/:month?', csvController.generate);

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
