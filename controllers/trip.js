// Module dependencies.
const nano = require('nano');
const _ = require('lodash');

const processResult = require('./result').generateResult;
const saveResult = require('./result').saveResult;

let BASE_DB, DB_URL, RESULT_DB;

/**
 * GET /workflow/result/:id
 * return result for a particular workflow
*/
exports.getResults = (req, res) => {
  DB_URL = req.body.base_db;
  BASE_DB = nano(DB_URL);
  RESULT_DB = req.body.result_db;
  let parentId;

  retrieveDoc(req.params.id)
    .then((doc) => {
      parentId = doc.tripId;
      return processWorkflowResult(doc.workflowId);
    })
    .then((result) => {
      return saveResult(result, parentId, RESULT_DB);
    })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

// Create workflow results
const processWorkflowResult = function(docId) {
  let workflowResults = {};

  return new Promise ((resolve, reject) => {
    getWorkflowById(docId)
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

// Retrieve document by id
function retrieveDoc(docId) {
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

// Retrieve a particular workflow collection
function getWorkflowById(docId) {
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.processWorkflowResult = processWorkflowResult;
