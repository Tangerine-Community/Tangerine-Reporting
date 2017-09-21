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
const saveDoc = require('./../utils/dbQuery').saveDoc;

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
  const feed = BASE_DB.follow({ since: 96009, include_docs: true });

  feed.on('change', async(resp) => {
    const docId = resp.doc._id;
    const assessmentId = resp.doc.assessmentId;
    const workflowId = resp.doc.workflowId;
    const tripId = resp.doc.tripId;
    const collectionType = resp.doc.collection;

    const isWorkflowIdSet = (workflowId) ? true : false;
    const isResult = (collectionType === 'result') ? true : false;
    const isWorkflow = (collectionType === 'workflow') ? true : false;
    const isAssessment = (collectionType === 'assessment') ? true : false;
    const isCurriculum = (collectionType === 'curriculum') ? true : false;
    const isQuestion = (collectionType === 'question') ? true : false;
    const isSubtest = (collectionType === 'subtest') ? true : false;

    if (isWorkflowIdSet && isResult) {
      feed.pause();
      const workflowResult = await processWorkflowResult(workflowId, dbUrl);
      await saveDoc(workflowResult, tripId, resultDbUrl);
      setTimeout(function() { feed.resume() }, 10 * 60 * 1000); // Resume after 10 minutes.
    }
    // TODO: Uncomment the code below
    // if (isWorkflowIdSet && isWorkflow) {
    //   feed.pause();
    //   const workflowHeaders = await generateWorkflowHeaders(workflowId, dbUrl);
    //   saveDoc(workflowHeaders, workflowId, resultDbUrl);
    //   setTimeout(function() { feed.resume() }, 10 * 60 * 1000); // Resume after 10 minutes.
    // }
    // if (!isWorkflowIdSet && isResult) {
    //   feed.pasue();
    //   const assessmentResult = await processAssessmentResult(assessmentId, dbUrl);
    //   await saveDoc(assessmentResult, docId, resultDbUrl);
    //   setTimeout(function() { feed.resume() }, 10 * 60 * 1000); // Resume after 10 minutes.
    // }
    // if (isAssessment || isCurriculum || isQuestion || isSubtest) {
    //   feed.pasue();
    //   const assessmentHeaders = await generateAssessmentHeaders(assessmentId, dbUrl);
    //   await saveDoc(assessmentHeaders, assessmentId, resultDbUrl);
    //   setTimeout(function() { feed.resume() }, 10 * 60 * 1000); // Resume after 10 minutes.
    // }

  });

  feed.on('error', (err) => res.send(Error(err)));

  feed.follow();
}
