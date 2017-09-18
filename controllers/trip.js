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
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;
  const docId = req.params.id;
  let tripId;

  getWorkflowDoc(docId, dbUrl)
    .then((data) => {
      tripId = data.tripId;
      return processWorkflowResult(data.workflowId, dbUrl);
    })
    .then(async(result) => {
      const saveResponse = await saveResult(result, tripId, resultDbUrl);
      res.json(saveResponse);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * Process results for ALL workflows in the database.
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
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;

  getAllResult(dbUrl)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let workflowId = item.workflowId;

        if (!workflowId) {
          let docId = item.assessmentId || item.curriculumId;
          let assessmentResults = await processResult(docId, 0, dbUrl);
          saveResponse = await saveResult(assessmentResults, item._id, resultDbUrl);
        } else {
          let processedResult = await processWorkflowResult(workflowId, dbUrl);
          saveResponse = await saveResult(processedResult, item.tripId, resultDbUrl);
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

const processWorkflowResult = function(docId, dbUrl) {
  let workflowResults = {};

  return new Promise ((resolve, reject) => {
    getWorkflowDoc(docId, dbUrl)
      .then(async(data) => {
        let workflowCounts = {
          assessmentCount: 0,
          curriculumCount: 0,
          messageCount: 0
        };

        for (item of data.children) {
          if (item.type === 'assessment') {
            let assessmentResults = await processResult(item.typesId, workflowCounts.assessmentCount, dbUrl);
            workflowResults = _.assignIn(workflowResults, assessmentResults);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumResults = await processResult(item.typesId, workflowCounts.curriculumCount, dbUrl);
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
 * @param {string} dbUrl - database url.
 *
 * @returns {Array} – all result documents.
 */

const getAllResult = function(dbUrl) {
  const BASE_DB = nano(dbUrl);
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
 * @param {string} dbUrl - database url.
 *
 * @returns {Object} - retrieved document.
 */

function getWorkflowDoc(docId, dbUrl) {
  const BASE_DB = nano(dbUrl);
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.processWorkflowResult = processWorkflowResult;
