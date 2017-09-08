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
 * Local modules.
 */

const generateAssessmentHeaders = require('./assessment').createColumnHeaders;
const processAssessmentResult = require('./result').generateResult;
const generateWorkflowHeaders = require('./workflow').createWorkflowHeaders;
const processWorkflowResult = require('./trip').processWorkflowResult;
const saveHeaders = require('./assessment').saveHeaders;
const saveResult = require('./result').saveResult;

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
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;
  const BASE_DB = nano(dbUrl);
  const feed = BASE_DB.follow({ since: 'now', include_docs:true });

  feed.on('change', async(resp) => {
    const docId = resp.doc.doc._id;
    const assessmentId = resp.doc.doc.assessmentId;
    const workflowId = resp.doc.doc.workflowId;
    const tripId = resp.doc.doc.tripId;
    const collectionType = resp.doc.doc.collection;

    const isWorkflowIdSet = (workflowId) ? true : false;
    const isResult = (collectionType === 'result') ? true : false;
    const isWorkflow = (collectionType === 'workflow') ? true : false;
    const isAssessment = (collectionType === 'assessment') ? true : false;
    const isCurriculum = (collectionType === 'curriculum') ? true : false;
    const isQuestion = (collectionType === 'question') ? true : false;
    const isSubtest = (collectionType === 'subtest') ? true : false;

    if (isWorkflowIdSet && isResult) {
      const workflowResult = await processWorkflowResult(workflowId, dbUrl);
      saveResult(workflowResult, tripId, resultDbUrl);
    }
    if (isWorkflowIdSet && isWorkflow) {
      const workflowHeaders = await generateWorkflowHeaders(workflowId, dbUrl);
      saveHeaders(workflowHeaders, workflowId, resultDbUrl);
    }
    if (!isWorkflowIdSet && isResult) {
      const assessmentResult = await processAssessmentResult(assessmentId, dbUrl);
      saveHeaders(assessmentResult, docId, resultDbUrl);
    }
    if (isAssessment || isCurriculum || isQuestion || isSubtest) {
      const assessmentHeaders = await generateAssessmentHeaders(assessmentId, dbUrl);
      saveHeaders(assessmentHeaders, assessmentId, resultDbUrl);
    }
    res.json(resp);
  });

  feed.on('error', (err) => res.send(Error(err)));

  feed.follow();
}
