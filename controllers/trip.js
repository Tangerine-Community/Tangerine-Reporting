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
 * Local dependencies.
 */

const processResult = require('./result').generateResult;
const dbQuery = require('./../utils/dbQuery');

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
  const tripId = req.params.id;

  dbQuery.getResults(tripId, dbUrl)
    .then(async(data) => {
      const result = processWorkflowResult(data);
      const saveResponse = await dbQuery.saveResult(result, resultDbUrl);
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

  dbQuery.getAllResult(dbUrl)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let resultDoc = [{ doc: item }];
        if (!item.tripId) {
          let docId = item.assessmentId || item.curriculumId;
          let assessmentResults = await processResult(resultDoc);
          saveResponse = await dbQuery.saveResult(assessmentResults, resultDbUrl);
          console.log(saveResponse);
        } else {
          let processedResult = await processWorkflowResult(resultDoc);
          saveResponse = await dbQuery.saveResult(processedResult, resultDbUrl);
          console.log(saveResponse);
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

const processWorkflowResult = function(data) {
  let workflowResults = {};
  let resultItems = [];

  for (item of data) {
    let isProcessed = _.filter(resultItems, { assessmentId: item.doc.assessmentId });
    let count = isProcessed.length;
    let processedResult = processResult(item, count);
    workflowResults = _.assignIn(workflowResults, processedResult);
    resultItems.push(item.doc);
  }
  return workflowResults;
}

exports.processWorkflowResult = processWorkflowResult;
