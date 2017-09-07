/**
 * This file processes the result of a workflow.
 * It also exposes the processWorkflowResult module.
 */

/**
 * Module dependencies.
*/
const nano = require('nano');
const _ = require('lodash');

/**
 * Module dependencies.
 */

const processResult = require('./result').generateResult;
const saveResult = require('./result').saveResult;

/**
 * Declare database variables.
 */

let BASE_DB, DB_URL, RESULT_DB;

/**
 * Processes result for a workflow.
 *
 * Example:
 *
 *    POST /workflow/result/:id
 *  where id refers to the id of the workflow document.
 *
 *  The request object must contain the main database url and a
 *  result database url where the generated headers will be saved.
 *     {
 *       "db_url": "http://admin:password@test.tangerine.org/database_name"
 *       "another_db_url": "http://admin:password@test.tangerine.org/result_database_name"
 *     }
 *
 * Response:
 *
 *   Returns an Object indicating the data has been saved.
 *      {
 *        "ok": true,
 *        "id": "a1234567890",
 *        "rev": "1-b123"
 *       }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.processResult = (req, res) => {
  DB_URL = req.body.base_db;
  BASE_DB = nano(DB_URL);
  RESULT_DB = nano(req.body.result_db);
  let tripId;

  getWorkflowDoc(req.params.id)
    .then((doc) => {
      tripId = doc.tripId;
      return processWorkflowResult(doc.workflowId);
    })
    .then((result) => {
      return saveResult(result, tripId, RESULT_DB);
    })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * Processes results for ALL workflows in the database.
 *
 * Example:
 *
 *    POST /workflow/result/_all
 *
 *  The request object must contain the main database url and a
 *  result database url where the generated headers will be saved.
 *     {
 *       "db_url": "http://admin:password@test.tangerine.org/database_name"
 *       "another_db_url": "http://admin:password@test.tangerine.org/result_database_name"
 *     }
 *
 * Response:
 *
 *   Returns an Object indicating the data has been saved.
 *      {
 *        "ok": true,
 *        "id": "a1234567890",
 *        "rev": "1-b123"
 *       }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.processAll = (req, res) => {
  DB_URL = req.body.base_db;
  BASE_DB = nano(DB_URL);
  RESULT_DB = nano(req.body.result_db);

  getAllResult(BASE_DB)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let workflowId = item.workflowId;

        if (!workflowId) {
          let docId = item.assessmentId || item.curriculumId;
          let assessmentResults = await processResult(docId, 0, DB_URL);
          saveResponse = await saveResult(assessmentResults, item._id, RESULT_DB);
        } else {
          let processedResult = await processWorkflowResult(workflowId);
          saveResponse = await saveResult(processedResult, item.tripId, RESULT_DB);
        }
      }
      res.json(saveResponse);
    })
    .catch((err) => res.send(Error(err)));
}


/*****************************
 *     APPLICATION MODULE    *
 *****************************
*/


/**
 * This function processes the result for a workflow.
 *
 * @param {string} docId - worklfow id of the document.
 *
 * @returns {Object} - processed result for csv.
 */

const processWorkflowResult = function(docId) {
  let workflowResults = {};

  return new Promise ((resolve, reject) => {
    getWorkflowDoc(docId)
      .then(async(data) => {
        let workflowCounts = {
          assessmentCount: 0,
          curriculumCount: 0,
          messageCount: 0
        };

        for (item of data.children) {
          if (item.type === 'assessment') {
            let assessmentResults = await processResult(item.typesId, workflowCounts.assessmentCount, DB_URL);
            workflowResults = _.assignIn(workflowResults, assessmentResults);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumResults = await processResult(item.typesId, workflowCounts.curriculumCount, DB_URL);
            workflowResults = _.assignIn(workflowResults, curriculumResults);
            workflowCounts.curriculumCount++;
          }
          if (item.type === 'message') {
            let messageSuffix = workflowCounts.messageCount > 0 ? `_${workflowCounts.messageCount}` : '';
            let messageKey = `${docId}.message${messageSuffix}`;
            workflowResults = _.assignIn(workflowResults, { [messageKey]: item.message });
            workflowCounts.messageCount++;
          }
        }
        resolve(workflowResults);
      })
      .catch((err) => reject(err));
  });
}


/********************************************
 *    HELPER FUNCTIONS FOR DATABASE QUERY   *
 ********************************************
*/


/**
 * This function retrieves all result collection in the database.
 *
 * @returns {Array} – all result documents.
 */

const getAllResult = function(BASE_DB) {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'csvRows', {
      include_docs: true
    }, (err, body) => {
      if (err) reject(err);
      let resultCollection = _.map(body.rows, (data) => data.doc);
      resolve(resultCollection);
    });
  });
}

/**
 * This function retrieves a document from the database.
 *
 * @param {string} docId - id of document.
 *
 * @returns {Object} - retrieved document.
 */

function getWorkflowDoc(docId) {
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.processWorkflowResult = processWorkflowResult;
