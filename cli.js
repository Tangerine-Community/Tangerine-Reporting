#!/usr/bin/env node

/**
 * CLI App Entry Point.
 */

/**
 * Module dependencies.
 */

const program = require('commander');

/**
 * Local Dependencies.
 */

const createColumnHeaders = require('./controllers/assessment').createColumnHeaders;
const processAssessmentResult = require('./controllers/result').generateResult;
const processWorkflowResult = require('./controllers/trip').processWorkflowResult;

const dbQuery = require('./utils/dbQuery');
const dbConfig = require('./config');


program
  .version('0.1.0')
  .command('assessment [dbUrl]')
  .description('Retrieves all assessments in the database')
  .action(async function(dbUrl) {
    const db = dbConfig.base_db || dbUrl;
    console.log(await dbQuery.getAllAssessment(db));
  });


program
  .version('0.1.0')
  .command('workflow [dbUrl]')
  .description('Retrieves all workflows in the database')
  .action(async function(dbUrl) {
    const db = dbConfig.base_db || dbUrl;
    console.log(await dbQuery.getAllWorkflow(db));
  });


program
  .version('0.1.0')
  .command('result [dbUrl]')
  .description('Retrieves all results in the database')
  .action(function(dbUrl) {
    const db = dbConfig.base_db || dbUrl;
    dbQuery.getAllResult(db)
      .then((result) => {
        console.log(result);
      })
      .catch((err) => Error(err));
  });


program
  .version('0.1.0')
  .command('assessment headers <id>')
  .description('generate headers for an assessment')
  .action(function(id) {
    createColumnHeaders(id, 0, dbConfig.base_db)
      .then(async(data) => {
        console.log(await dbQuery.saveDoc(data, id, dbConfig.result_db));
      })
    .catch((err) => Error(err));
  });

program
  .version('0.1.0')
  .command('assessment-result <id>')
  .description('process result for an assessment')
  .action(function(id) {
    processAssessmentResult(id, 0, dbConfig.base_db)
      .then(async(result) => {
        console.log(await dbQuery.saveDoc(result, id, dbConfig.result_db));
      })
    .catch((err) => Error(err));
  });


program.parse(process.argv);
