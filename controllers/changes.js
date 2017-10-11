/**
 * This file implements couch DB changes features.
 * It watches for any changes in the database and
 * processes the changed document based on its collection type.
 */

/**
 * Module Dependencies.
 */

const _ = require('lodash');
const Excel = require('exceljs');
const nano = require('nano');

/**
 * Local Depencies.
 */

const generateAssessmentHeaders = require('./assessment').createColumnHeaders;
const processAssessmentResult = require('./result').generateResult;
const generateWorkflowHeaders = require('./workflow').createWorkflowHeaders;
const processWorkflowResult = require('./trip').processWorkflowResult;
const saveHeaders = require('./../utils/dbQuery').saveHeaders;
const saveResult = require('./../utils/dbQuery').saveResult;
const dbConfig = require('./../config');

/**
 * Processes any recently changed document in the database based on its collection type.
 *
 * Example:
 *
 *    POST /tangerine_changes
 *
 *  The request object must contain the database url and the result database url.
 *       {
 *         "db_url": "http://admin:password@test.tangerine.org/database_name"
 *         "another_db_url": "http://admin:password@test.tangerine.org/result_database_name"
 *       }
 *
 * Response:
 *
 * Returns the changed document in the database.
 *      {
 *        "seq": 1001,
 *        "id": "e1234567890",
 *        "changes": [
 *            {
 *              "rev": "1-123a"
 *            }
 *        ]
 *      }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.changes = (req, res) => {
  const dbUrl = req.body.base_db || dbConfig.base_db;
  const resultDbUrl = req.body.result_db || dbConfig.result_db;
  const BASE_DB = nano(dbUrl);
  const feed = BASE_DB.follow({ since: 'now', include_docs: true });

  feed.on('change', (resp) => {
    processChangedDocument(resp, dbUrl, resultDbUrl);
  });

  feed.on('error', (err) => res.send(Error(err)));
  feed.follow();
}

const processChangedDocument = async(resp, dbUrl, resultDbUrl) => {
  const assessmentId = resp.doc.assessmentId;
  const workflowId = resp.doc.workflowId;
  const collectionType = resp.doc.collection;

  const isWorkflowIdSet = (workflowId) ? true : false;
  const isResult = (collectionType === 'result') ? true : false;
  const isWorkflow = (collectionType === 'workflow') ? true : false;
  const isAssessment = (collectionType === 'assessment') ? true : false;
  const isCurriculum = (collectionType === 'curriculum') ? true : false;
  const isQuestion = (collectionType === 'question') ? true : false;
  const isSubtest = (collectionType === 'subtest') ? true : false;

  if (isWorkflowIdSet && isResult) {
    console.info('\n<<<=== START PROCESSING WORKFLOW RESULT ===>>>\n');
    const workflowResult = await processWorkflowResult([resp], dbUrl);
    const saveResponse = await saveResult(workflowResult, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING WORKFLOW RESULT ===>>>\n');
  }
  if (!isWorkflowIdSet && isResult) {
    console.info('\n<<<=== START PROCESSING ASSESSMENT RESULT  ===>>>\n');
    const assessmentResult = await processAssessmentResult([resp]);
    const saveResponse = await saveResult(assessmentResult, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING ASSESSMENT RESULT ===>>>\n');
  }
  if (isWorkflow) {
    console.info('\n<<<=== START PROCESSING WORKFLOW COLLECTION  ===>>>\n');
    const workflowHeaders = await generateWorkflowHeaders(resp.doc, dbUrl);
    const saveResponse = await saveHeaders(workflowHeaders, workflowId, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING WORKFLOW COLLECTION ===>>>\n');
  }
  if (isAssessment || isCurriculum || isQuestion || isSubtest) {
    console.info('\n<<<=== START PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION  ===>>>\n');
    const assessmentHeaders = await generateAssessmentHeaders(assessmentId, 0, dbUrl);
    const saveResponse = await saveHeaders(assessmentHeaders, assessmentId, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION ===>>>\n');
  }
}

exports.processChangedDocument = processChangedDocument;
