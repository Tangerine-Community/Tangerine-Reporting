#!/usr/bin/env node

/**
 * CLI App Entry Point.
 */

/**
 * Module dependencies.
 */

const tangerine = require('commander');
const chalk = require('chalk');

/**
 * Local Dependencies.
 */

const createColumnHeaders = require('./controllers/assessment').createColumnHeaders;
const processAssessmentResult = require('./controllers/result').generateResult;
const createWorkflowHeaders = require('./controllers/workflow').createWorkflowHeaders;
const processWorkflowResult = require('./controllers/trip').processWorkflowResult;

const dbQuery = require('./utils/dbQuery');
const dbConfig = require('./config');

/******************************************
 *  HELPER FUNCTIONS FOR GENERATING AND   *
 *      SAVING HEADERS AND RESULTS        *
 ******************************************
*/


/**
 * This function creates and saves assessment headers.
 *
 * @param {Array} data - database documents to be processed.
 *
 * @returns {Object} - couchDB save response
 */

async function generateAssessmentHeaders(data) {
  let response;
  for (item of data) {
    let assessmentId = item.doc.assessmentId;
    let generatedHeaders = await createColumnHeaders(assessmentId, 0, dbConfig.base_db);
    response = await dbQuery.saveDoc(generatedHeaders, assessmentId, dbConfig.result_db);
  }
  return response;
}

/**
 * This function creates and saves workflow headers.
 *
 * @param {Array} data - database documents to be processed.
 *
 * @returns {Object} - couchDB save response
 */

async function generateworkflowHeaders(data) {
  let response;
  for (item of data) {
    let assessmentId = item.doc.assessmentId;
    let generatedHeaders = await createColumnHeaders(assessmentId, 0, dbConfig.base_db);
    response = await dbQuery.saveDoc(generatedHeaders, assessmentId, dbConfig.result_db);
  }
  return response;
}

/**
 * This function creates and saves assessment results.
 *
 * @param {Array} data - database documents to be processed.
 *
 * @returns {Object} - couchDB save response
 */

async function generateAssessmentResult(data) {
  let response;
  for (item of data) {
    let docId = item.assessmentId || item.curriculumId;
    let ref = item._id;
    let processedResult = await processAssessmentResult(docId, 0, dbConfig.base_db);
    response = await dbQuery.saveDoc(processedResult, ref, dbConfig.result_db);
  }
  return response;
}

/**
 * This function creates and saves workflow results.
 *
 * @param {Array} data - database documents to be processed.
 *
 * @returns {Object} - couchDB save response
 */

async function generateWorkflowResult(data) {
  let response;
  for (item of data) {
    let workflowId = item.workflowId;
    if (!workflowId) {
      let docId = item.assessmentId || item.curriculumId;
      let assessmentResults = await processAssessmentResult(docId, 0, dbConfig.base_db);
      response = await dbQuery.saveDoc(assessmentResults, item._id, dbConfig.result_db);
    } else {
      let processedResult = await processWorkflowResult(workflowId, dbUrl);
      response = await dbQuery.saveDoc(processedResult, item.tripId, dbConfig.result_db);
    }
  }
  return response;
}

/**********************
 *  CLI APPLICATION   *
 **********************
*/

tangerine
  .version('0.1.0')
  .command('assessment [dbUrl]')
  .description('Retrieves all assessments in the database')
  .action(async(dbUrl) => {
    const db = dbConfig.base_db || dbUrl;
    console.log(await dbQuery.getAllAssessment(db));
  });


tangerine
  .version('0.1.0')
  .command('workflow [dbUrl]')
  .description('Retrieves all workflows in the database')
  .action(async(dbUrl) => {
    const db = dbConfig.base_db || dbUrl;
    console.log(await dbQuery.getAllWorkflow(db));
  });


tangerine
  .version('0.1.0')
  .command('result [dbUrl]')
  .description('Retrieves all results in the database')
  .action(async(dbUrl) => {
    const db = dbConfig.base_db || dbUrl;
    console.log(await dbQuery.getAllResult(db));
  });


tangerine
  .version('0.1.0')
  .command('assessment-header <id>')
  .description('generate header for an assessment')
  .action((id) => {
    createColumnHeaders(id, 0, dbConfig.base_db)
      .then(async(data) => {
        console.log(await dbQuery.saveDoc(data, id, dbConfig.result_db));
      })
      .catch((err) => Error(err));
  });


tangerine
  .version('0.1.0')
  .command('assessment-result <id>')
  .description('process result for an assessment')
  .action((id) => {
    processAssessmentResult(id, 0, dbConfig.base_db)
      .then(async(result) => {
        console.log(await dbQuery.saveDoc(result, id, dbConfig.result_db));
      })
      .catch((err) => Error(err));
  });


tangerine
  .version('0.1.0')
  .command('workflow-header <id>')
  .description('generate headers for a workflow')
  .action((id) => {
    createWorkflowHeaders(id, dbConfig.base_db)
      .then(async(data) => {
        console.log(await dbQuery.saveDoc(data, id, dbConfig.result_db));
      })
      .catch((err) => Error(err));
  });


tangerine
  .version('0.1.0')
  .command('workflow-result <id>')
  .description('process result for a workflow')
  .action(function(id) {
    let tripId;

    dbQuery.retrieveDoc(id, dbConfig.base_db)
      .then((data) => {
        tripId = data.tripId;
        return processWorkflowResult(data.workflowId, dbConfig.base_db);
      })
      .then(async(result) => {
        console.log(await dbQuery.saveDoc(result, tripId, dbConfig.result_db));
      })
      .catch((err) => Error(err));
  });


tangerine
  .version('0.1.0')
  .command('generate-all')
  .description('generate headers or results based on the collection type')
  .option('-a', '--assessment', 'generate all assessment headers')
  .option('-r', '--result', 'generate all assessment results')
  .option('-w', '--workflow', 'generate all workflow headers')
  .option('-t', '--workflow-result', 'generate all workflow results')
  .action((options) => {
    if (!options.A && !options.R && !options.W && !options.T) {
      console.log(chalk.red('Please select a flag either "-a", "-r", "t", or "-w" flag along with your command. \n'));
    }
    if (options.A) {
      dbQuery.getAllAssessment(dbConfig.base_db)
      .then(async(data) => {
        generateAssessmentHeaders(data);
      }).catch((err) => Error(err));
    }
    if (options.W) {
      dbQuery.getAllWorkflow(dbConfig.base_db)
      .then(async(data) => {
        generateworkflowHeaders(data);
      }).catch((err) => Error(err));
    }
    if (options.R)  {
      dbQuery.getAllResult(dbConfig.base_db)
      .then(async(data) => {
        generateAssessmentResult(data);
      }).catch((err) => Error(err));
    }
    if (options.T) {
      dbQuery.getAllWorkflow(dbConfig.base_db)
      .then(async(data) => {
        generateWorkflowResult(data);
      }).catch((err) => Error(err));
    }
  }).on('--help', function() {
    console.log(chalk.blue('\n Examples: \n'));
    console.log(chalk.blue('  $ tangerine-reporting generate-all -a'));
    console.log(chalk.blue('  $ tangerine-reporting generate-all -r'));
    console.log(chalk.blue('  $ tangerine-reporting generate-all -t'));
    console.log(chalk.blue('  $ tangerine-reporting generate-all -w \n'));
  });


tangerine.parse(process.argv);

if (process.argv.length === 0) {
  tangerine.help();
}

console.log(chalk.green('✓ Tangerine Reporting Cli Tool'));
