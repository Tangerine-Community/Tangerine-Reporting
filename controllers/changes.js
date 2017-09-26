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
    feed.pause();
    processChangedDocument(resp, dbUrl, resultDbUrl);
    setTimeout(function() { feed.resume() }, 10 * 1000); // Resume after 10s.
  });

  feed.on('error', (err) => res.send(Error(err)));

  feed.follow();
}

const processChangedDocument = async(resp, dbUrl, resultDbUrl) => {
  const docId = resp.doc._id;
  const assessmentId = resp.doc.assessmentId;
  const workflowId = resp.doc.workflowId;
  const tripId = resp.doc.tripId;
  const collectionType = resp.doc.collection;
  const count = 0;

  const isWorkflowIdSet = (workflowId) ? true : false;
  const isResult = (collectionType === 'result') ? true : false;
  const isWorkflow = (collectionType === 'workflow') ? true : false;
  const isAssessment = (collectionType === 'assessment') ? true : false;
  const isCurriculum = (collectionType === 'curriculum') ? true : false;
  const isQuestion = (collectionType === 'question') ? true : false;
  const isSubtest = (collectionType === 'subtest') ? true : false;

  if (isWorkflowIdSet && isResult) {
    console.info('<<<=== START PROCESSING WORKFLOW RESULT ===>>>');
    const workflowResult = await processWorkflowResult(workflowId, dbUrl);
    await saveResult(workflowResult, tripId, resultDbUrl);
    console.info('<<<=== END PROCESSING WORKFLOW RESULT ===>>>');
  }
  if (!isWorkflowIdSet && isResult) {
    console.info('<<<=== START PROCESSING ASSESSMENT RESULT  ===>>>');
    const assessmentResult = await processAssessmentResult(assessmentId, count, dbUrl);
    await saveResult(assessmentResult, docId, resultDbUrl);
    console.info('<<<=== END PROCESSING ASSESSMENT RESULT ===>>>');
  }
  if (isWorkflow) {
    console.info('<<<=== START PROCESSING WORKFLOW COLLECTION  ===>>>');
    const workflowHeaders = await generateWorkflowHeaders(docId, dbUrl);
    await saveHeaders(workflowHeaders, docId, resultDbUrl);
    console.info('<<<=== END PROCESSING WORKFLOW COLLECTION ===>>>');
  }
  if (isAssessment || isCurriculum || isQuestion || isSubtest) {
    console.info('<<<=== START PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION  ===>>>');
    const assessmentHeaders = await generateAssessmentHeaders(assessmentId, count, dbUrl);
    await saveHeaders(assessmentHeaders, assessmentId, resultDbUrl);
    console.info('<<<=== END PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION ===>>>');
  }
}

exports.processChangedDocument = processChangedDocument;
