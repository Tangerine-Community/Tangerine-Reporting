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

const generateAssessmentHeaders = require('./controllers/assessment').createColumnHeaders;
const processAssessmentResult = require('./controllers/result').generateResult;
const generateWorkflowHeaders = require('./controllers/workflow').createWorkflowHeaders;
const processWorkflowResult = require('./controllers/trip').processWorkflowResult;
const generateCSV = require('./controllers/generate_csv').generateCSV;
const dbQuery = require('./utils/dbQuery');


/******************************************
 *  HELPER FUNCTIONS FOR GENERATING AND   *
 *      SAVING HEADERS AND RESULTS        *
 ******************************************
 */


/**
 * This function creates and saves assessment headers.
 *
 * @param {Array} data - database documents to be processed.
 */

async function generateAssessmentHeaders(data, dbUrl, resultDbUrl) {
  for (item of data) {
    let assessmentId = item.doc.assessmentId;
    let generatedHeaders = await generateAssessmentHeaders(item.doc, 0, dbUrl);
    generatedHeaders.unshift(item.doc.name);
    let saveResponse = await dbQuery.saveHeaders(generatedHeaders, assessmentId, resultDbUrl);
    console.log(saveResponse);
  }
  return true;
}

/**
 * This function creates and saves workflow headers.
 *
 * @param {Array} data - database documents to be processed.
 */

async function generateworkflowHeaders(data, dbUrl, resultDbUrl) {
  for (item of data) {
    let workflowId = item.id;
    let generatedWorkflowHeaders = await generateWorkflowHeaders(item.doc, dbUrl);
    let saveResponse = await dbQuery.saveHeaders(generatedWorkflowHeaders, workflowId, resultDbUrl);
    console.log(saveResponse);
  }
  return true;
}

/**********************
 *  CLI APPLICATION   *
 **********************
 */

/**
 * This part retrieves all assessments in the database.
 * It is executed when the command `tangerine-reporting assessments` is run.
 *
 * @param {string} db - database url
 */
tangerine
  .version('0.1.0')
  .command('assessments <db>')
  .description('Retrieves all assessments in the database')
  .action(async(db) => {
    console.log(await dbQuery.getAllAssessment(db));
    console.log(chalk.green('✓ Successfully retrieve all assessments'));
  });

/**
 * This part retrieves all workflow documents in the database.
 * It is executed when the command `tangerine-reporting workflows` is run.
 *
 * @param {string} db - database url
 */
tangerine
  .version('0.1.0')
  .command('workflows <db>')
  .description('Retrieves all workflows in the database')
  .action(async(db) => {
    console.log(await dbQuery.getAllWorkflow(db));
    console.log(chalk.green('✓ Successfully retrieve all workflows'));
  });

/**
 * This part retrieves all result documents in the database.
 * It is executed when the command `tangerine-reporting results` is run.
 *
 * @param {string} db - database url
 */
tangerine
  .version('0.1.0')
  .command('results <db>')
  .description('Retrieves all results in the database')
  .action(async(db) => {
    console.log(await dbQuery.getAllResult(db));
    console.log(chalk.green('✓ Successfully retrieve all results'));
  });

/**
 * This part generates an assessment header.
 * It is executed when the command `tangerine-reporting assessment-header <assessment_id>` is run.
 *
 * @param {string} id - assessment id is required.
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('assessment-header <id> <dbUrl> <resultDbUrl>')
  .description('generate header for an assessment')
  .action((id, dbUrl, resultDbUrl) => {
    dbQuery.retrieveDoc(id, dbUrl)
      .then(async(data) => {
        const docId = data.assessmentId || data.curriculumId;
        const colHeaders = await generateAssessmentHeaders(data, 0, dbUrl);
        colHeaders.unshift(data.name); // Add assessment name. Needed for csv file name.
        const saveResponse = await dbQuery.saveHeaders(colHeaders, docId, resultDbUrl);
        console.log(saveResponse);
        console.log(chalk.green('✓ Successfully generate and save assessment header'));
      })
      .catch((err) => Error(err));
  });

/**
 * This part processes an assessment result.
 * It is executed when the command `tangerine-reporting assessment-result <assessment_id>` is run.
 *
 * @param {string} id - assessment id is required.
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('assessment-result <id> <dbUrl> <resultDbUrl>')
  .description('process result for an assessment')
  .action((id, dbUrl, resultDbUrl) => {
    dbQuery.retrieveDoc(id, dbUrl)
      .then(async(data) => {
        let resultDoc = { doc: data };
        const result = processAssessmentResult(resultDoc, 0, dbUrl);
        let docId = result.indexKeys.collectionId;
        let groupTimeZone = result.indexKeys.groupTimeZone;
        let allTimestamps = _.sortBy(result.indexKeys.timestamps);

        // Validate result from all subtest timestamps
        let validationData = await validateResult(docId, groupTimeZone, dbUrl, allTimestamps);
        result.isValid = validationData.isValid;
        result.isValidReason = validationData.reason;
        result[`${docId}.start_time`] = validationData.startTime;
        result[`${docId}.end_time`] = validationData.endTime;

        result.indexKeys.ref = result.indexKeys.ref;
        result.indexKeys.parent_id = docId;
        result.indexKeys.year = validationData.indexKeys.year;
        result.indexKeys.month = validationData.indexKeys.month;
        result.indexKeys.day = validationData.indexKeys.day;

        const saveResponse = await dbQuery.saveResult(result, resultDbUrl);
        console.log(saveResponse);
        console.log(chalk.green('✓ Successfully process and save assessment result'));
      })
      .catch((err) => Error(err));
  });

/**
 * This part generates a workflow header.
 * It is executed when the command `tangerine-reporting workflow-header <workflow_id>` is run.
 *
 * @param {string} id - workflow id is required.
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('workflow-header <id> <dbUrl> <resultDbUrl>')
  .description('generate headers for a workflow')
  .action((id, dbUrl, resultDbUrl) => {
    dbQuery.retrieveDoc(id, dbUrl)
      .then(async(doc) => {
        let colHeaders = await generateWorkflowHeaders(doc, dbUrl);
        const saveResponse = await dbQuery.saveHeaders(colHeaders, workflowId, resultDbUrl);
        console.log(saveResponse);
        console.log(chalk.green('✓ Successfully generate and save workflow header'));
      })
      .catch((err) => Error(err));
  });

/**
 * This part processes a workflow result.
 * It is executed when the command `tangerine-reporting workflow-result <workflow_id>` is run.
 *
 * @param {string} id - workflow id is required.
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('workflow-result <id> <dbUrl> <resultDbUrl>')
  .description('process result for a workflow')
  .action((id, dbUrl, resultDbUrl) => {
    dbQuery.getResults(id, dbUrl)
      .then(async(data) => {
        const result = processWorkflowResult(data, dbUrl);
        const saveResponse = await dbQuery.saveResult(result, resultDbUrl);
        console.log(saveResponse);
        console.log(chalk.green('✓ Successfully process and save workflow result'));
      })
      .catch((err) => Error(err));
  });

/**
 * This part processes headers or results based on the flag passed to it.
 *
 * It is executed when the command `tangerine-reporting create-all [flags]` is run.
 * The various flags are required for this to execute.
 * E.g. run `tangerine-reporting create-all -w` => to generate all workflow headers in the database
 *
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('create-all <dbUrl> <resultDbUrl>')
  .description('create all headers based on the collection type')
  .option('-a', '--assessment', 'create all assessment headers')
  .option('-w', '--workflow', 'create all workflow headers')
  .action((dbUrl, resultDbUrl, options) => {
    if (!options.A && !options.W) {
      console.log(chalk.red('Please select a flag either "-a", "-r", "-t", or "-w" flag along with your command. \n'));
    }
    if (options.A) {
      dbQuery.getAllAssessment(dbUrl)
        .then(async(data) => {
          await generateAssessmentHeaders(data, dbUrl, resultDbUrl);
          console.log(chalk.green('✓ Successfully generate and save all assessment headers'));
        }).catch((err) => Error(err));
    }
    if (options.W) {
      dbQuery.getAllWorkflow(dbUrl)
        .then(async(data) => {
          await generateworkflowHeaders(data, dbUrl, resultDbUrl);
          console.log(chalk.green('✓ Successfully generate and save all workflow headers'));
        }).catch((err) => Error(err));
    }
  }).on('--help', function() {
    console.log(chalk.blue('\n Examples: \n'));
    console.log(chalk.blue('  $ tangerine-reporting create-all -a'));
    console.log(chalk.blue('  $ tangerine-reporting create-all -w \n'));
  });

/**
 * This part generates a csv file.
 * It is executed when the command `tangerine-reporting generate-csv <docId>` is run.
 *
 * @param {string} docId - workflow id  of the document
 * @param {string} resultDbUrl - result database url
 */
tangerine
  .version('0.1.0')
  .command('generate-csv <docId> <resultDbUrl>')
  .description('creates a csv file')
  .action((docId, resultDbUrl) => {
    dbQuery.retrieveDoc(docId, resultDbUrl)
      .then(async(docHeaders) => {
        const result = await dbQuery.getProcessedResults(docId, resultDbUrl);
        await generateCSV(docHeaders, result);
        console.log(chalk.green('✓ CSV Successfully Generated'));
      })
      .catch((err) => Error(err));
  });

/**
 * This part retrieves a document from the database.
 * It is executed when the command `tangerine-reporting get <id>` is run.
 *
 * @param {string} id - id of the document
 * @param {string} db - database url
 */
tangerine
  .version('0.1.0')
  .command('get <id> <db>')
  .description('retrieve a document from the database')
  .action((id, db) => {
    dbQuery.retrieveDoc(id, db)
      .then((data) => {
        console.log(data);
        console.log(chalk.green('✓ Successfully fetch document'));
      })
      .catch((err) => console.error(err));
  });



tangerine.parse(process.argv);

if (process.argv.length === 0) {
  tangerine.help();
}

console.log(chalk.green('✓ Tangerine Reporting CLI Tool'));
