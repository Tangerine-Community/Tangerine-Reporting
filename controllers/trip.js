// Module dependencies.
const _ = require('lodash');

// Connect to Couch DB
const nano = require('nano');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const processResult = require('./result').generateResult;
const saveResult = require('./result').saveResult;

/**
 * GET /workflow/result/:id
 * return result for a particular workflow
*/
exports.getResults = (req, res) => {
  let parentId;
  retrieveDoc(req.params.id)
    .then((doc) => {
      parentId = doc.tripId;
      return processWorkflowResult(doc.workflowId);
    })
    .then((result) => {
      return saveResult(result, parentId);
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
            let assessmentResults = await processResult(item.typesId, workflowCounts.assessmentCount);
            workflowResults = _.assignIn(workflowResults, assessmentResults);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumResults = await processResult(item.typesId, workflowCounts.curriculumCount);
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
    TAYARI_BACKUP.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

// Retrieve a particular workflow collection
function getWorkflowById(docId) {
  return new Promise ((resolve, reject) => {
    TAYARI_BACKUP.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.processWorkflowResult = processWorkflowResult;
