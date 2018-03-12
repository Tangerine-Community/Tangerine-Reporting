/**
 * This file processes the result of a workflow.
 * It also exposes the processWorkflowResult module.
 */

/**
 * Module dependencies.
 */

const nano = require('nano');
const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');
moment().format();

/**
 * Local dependencies.
 */

const generateResult = require('./result').generateResult;
const validateResult = require('./result').validateResult;
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
      let totalResult = {};
      const result = await processWorkflowResult(data, dbUrl);
      result.forEach(element => totalResult = Object.assign(totalResult, element));
      // const saveResponse = await dbQuery.saveResult(totalResult, resultDbUrl);
      // console.log(saveResponse);
      // res.json(result);
      res.json(totalResult);
    })
    .catch((err) => res.send(err));
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
        let processedResult = {};
        if (!item.tripId) {
          let docId = item.assessmentId || item.curriculumId;
          let assessmentResults = await generateResult(resultDoc, 0, dbUrl);
          saveResponse = await dbQuery.saveResult(assessmentResults, resultDbUrl);
          console.log(saveResponse);
        } else {
          let result = await processWorkflowResult(resultDoc, 0, dbUrl);
          result.forEach(element => processedResult = Object.assign(processedResult, element));
          saveResponse = await dbQuery.saveResult(processedResult, resultDbUrl);
          console.log(saveResponse);
        }
      }
      res.json(saveResponse);
    })
    .catch((err) => res.send(err));
}


/*****************************
 *     APPLICATION MODULE    *
 *****************************
 */


/**
 * This function processes the result for a workflow.
 *
 * @param {Array} data - an array of workflow results.
 * @param {string} dbUrl - database url.
 *
 * @returns {Object} - processed result for csv.
 */

const processWorkflowResult = function (data, dbUrl) {
  let allTimestamps = [];
  let dataCount = 1;

  return Promise.mapSeries(data, async (item, index) => {
    let itemId = item.doc.workflowId || item.doc.assessmentId || item.doc.curriculumId;
    if (itemId != undefined) {
      let tripResult = await generateResult(item, index, dbUrl);
      console.log('index', index);
      allTimestamps.push(tripResult.timestamps);
      if (dataCount === data.length) {
        let flatTimestamps = _.flatten(allTimestamps);
        let validationData = await validateResult(tripResult.collectionId, tripResult.groupTimeZone, dbUrl, flatTimestamps);
        tripResult.isValid = validationData.isValid;
        tripResult.isValidReason = validationData.reason;
        tripResult[`${tripResult.collectionId}.start_time`] = moment(validationData.startTime).format('hh:mm');
        tripResult[`${tripResult.collectionId}.end_time`] = moment(validationData.endTime).format('hh:mm');

        tripResult.indexKeys.year = moment(validationData.startTime).year();
        tripResult.indexKeys.month = moment(validationData.startTime).format('MMM');
        tripResult.indexKeys.day = moment(validationData.startTime).date();
        tripResult.indexKeys.time = moment(validationData.startTime).format('hh:mm');

        console.log('trp', tripResult);

      }
      dataCount++;
      return tripResult;
    }
  });
  // return tripResults;
}

exports.processWorkflowResult = processWorkflowResult;
