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

/**
 * Declare database variables
 */

let BASE_DB, DB_URL, RESULT_DB;

/**
 * Retrieves all workflow collection in the database.
 *
 * Example:
 *
 *    POST /workflow
 *
 *  The request object must contain the database url
 *       {
 *         "db_url": "http://admin:password@test.tangerine.org/database_name"
 *       }
 *
 * Response:
 *
 *  Returns an Array of objects of workflow collections.
 *    [
 *    	{
 *        "id": "a1234567890",
 *        "key": "assessment",
 *        "value": {
 *        	"r": "1-b123"
 *        },
 *        "doc": {
 *        	"_id": "a1234567890",
 *        	"_rev": "1-b123",
 *        	"name": "After Testing",
 *        	"assessmentId": "a1234567890",
 *        	"collection": "workflow"
 *        }
 *      },
 *      ...
 *    ]
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.all = (req, res) => {
  BASE_DB = nano(req.body.base_db);

  getAllWorkflow(BASE_DB)
    .then((data) => res.json(data))
    .catch((err) => res.json(Error(err)))
}

/**
 * Generates headers for a workflow.
 *
 * Example:
 *
 *    POST /workflow/headers/:id
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
 * Generates headers for ALL workflows in the database.
 *
 * Example:
 *
 *    POST /workflow/headers/_all
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

exports.generateAll = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  RESULT_DB = nano(req.body.result_db);

  getAllWorkflow(BASE_DB)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let workflowId = item.id;
        let workflowHeaders = await createWorkflowHeaders(workflowId);
        saveResponse = await saveHeaders(workflowHeaders, workflowId, RESULT_DB);
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
 * This function creates headers for a workflow.
 *
 * @param {string} docId - worklfow id of the document.
 *
 * @returns {Array} - generated headers for csv.
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


/********************************************
 *    HELPER FUNCTIONS FOR DATABASE QUERY   *
 ********************************************
*/


/**
 * This function retrieves all workflow collections in the database.
 *
 * @returns {Array} – all workflow documents.
 */

const getAllWorkflow = function(BASE_DB) {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'byCollection', {
      key: 'workflow',
      include_docs: true
    }, (err, body) => {
      if (err) reject(err);
      resolve(body.rows);
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

function retrieveDoc(docId) {
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.createWorkflowHeaders = createWorkflowHeaders;
