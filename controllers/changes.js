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
const processWorkflowResult = require('./workflow').processWorkflowResult;

/**
 * Declare database variable.
 */

let BASE_DB;

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
  BASE_DB = nano(req.body.base_db);
  const feed = BASE_DB.follow({ since: 'now', include_docs:true });

  feed.on('change', (resp) => {
    let isWorkflowIdSet = (resp.doc.doc.workflowId) ? true : false;
    let isResult = (resp.doc.doc.collection === 'result') ? true : false;
    let isWorkflow = (resp.doc.doc.collection === 'workflow') ? true : false;
    let isAssessment = (resp.doc.doc.collection === 'assessment') ? true : false;
    let isCurriculum = (resp.doc.doc.collection === 'curriculum') ? true : false;
    let isQuestion = (resp.doc.doc.collection === 'question') ? true : false;
    let isSubtest = (resp.doc.doc.collection === 'subtest') ? true : false;

    if (isWorkflowIdSet && isResult) {
      processWorkflowResult(resp.doc.doc.workflowId);
    }
     if (isWorkflowIdSet && isWorkflow) {
      generateWorkflowHeaders(resp.doc.doc.workflowId);
    }
    if (!isWorkflowIdSet && isResult) {
      processAssessmentResult(resp.doc.doc.assessmentId);
    }
    if (isAssessment || isCurriculum || isQuestion || isSubtest) {
      generateAssessmentHeaders(resp.doc.doc.assessmentId);
    }
    res.json(resp);
  });

  feed.on('error', (err) => res.send(Error(err)));

  feed.follow();
}
