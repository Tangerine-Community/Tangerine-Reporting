/**
 * This file generates the metadata for a workflow.
 * It also exposes the createWorkflowHeaders module.
 */

/**
 * Module dependencies
 */
const _ = require('lodash');
const nano = require('nano');

/**
 * Local module
 */
const generateHeaders = require('./assessment').createColumnHeaders;
const saveHeaders = require('./assessment').saveHeaders;
const processResult = require('./result').generateResult;
const saveResult = require('./result').saveResult;

/**
 * Declare database variables
 */
let BASE_DB, DB_URL, RESULT_DB;

/**
 * POST /workflow
 * returns all workflow collection in the database.
 */
exports.all = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  BASE_DB.view('ojai', 'byCollection', {
    key: 'workflow',
    include_docs: true
  }, (err, body) => {
    if (err) res.send(err);
    res.json(body.rows)
  });
}

/**
 * POST /workflow/headers/:id
 * returns processed metadata for a workflow
 */
exports.getHeaders = (req, res) => {
  DB_URL = req.body.base_db;
  BASE_DB = nano(DB_URL);
  RESULT_DB = nano(req.body.result_db);
  let workflowId;

  retrieveDoc(req.params.id)
    .then((doc) => {
      workflowId = doc.workflowId;
      return createWorkflowHeaders(workflowId);
    })
    .then((colHeaders) => {
      return saveHeaders(colHeaders, workflowId, RESULT_DB);
    })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * This function creates headers for a workflow.
 * @param {string} docId worklfow id of the document.
 * @returns {Array} generated headers for csv.
 */
const createWorkflowHeaders = function(docId) {
  let workflowHeaders = [];

  return new Promise ((resolve, reject) => {
    retrieveDoc(docId)
      .then(async(data) => {
        let workflowCounts = {
          assessmentCount: 0,
          curriculumCount: 0,
          messageCount: 0
        };

        for (item of data.children) {
          if (item.type === 'assessment') {
            let assessmentHeaders = await generateHeaders(item.typesId, workflowCounts.assessmentCount, DB_URL);
            workflowHeaders.push(assessmentHeaders);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumHeaders = await generateHeaders(item.typesId, workflowCounts.curriculumCount, DB_URL);
            workflowHeaders.push(curriculumHeaders);
            workflowCounts.curriculumCount++;
          }
          if (item.type === 'message') {
            let messageSuffix = workflowCounts.messageCount > 0 ? `_${workflowCounts.messageCount}` : '';
            workflowHeaders.push({ headers: `message${messageSuffix}`, key: `${docId}.message${messageSuffix}`});
            workflowCounts.messageCount++;
          }
        }
        workflowHeaders = _.flatten(workflowHeaders);

        resolve(workflowHeaders);
      })
      .catch((err) => reject(err));
  });
}

/**
 * This function retrieves a document from the database.
 * @param {string} docId id of document.
 * @returns {Object} retrieved document.
 */
function retrieveDoc(docId) {
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.createWorkflowHeaders = createWorkflowHeaders;
