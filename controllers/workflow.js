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
 * Local modules
 */

const createColumnHeaders = require('./assessment').createColumnHeaders;
const saveHeaders = require('./assessment').saveHeaders;

/**
 * Retrieves all workflow collections in the database.
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
  getAllWorkflow(req.body.base_db)
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

exports.generateHeader = (req, res) => {
  let dbUrl = req.body.base_db;
  let resultDbUrl = req.body.result_db;
  let workflowId;

  retrieveDoc(req.params.id, dbUrl)
    .then((doc) => {
      workflowId = doc.workflowId;
      return createWorkflowHeaders(workflowId, dbUrl);
    })
    .then((colHeaders) => {
      return saveHeaders(colHeaders, workflowId, resultDbUrl);
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
  let dbUrl = req.body.base_db;
  let resultDbUrl = req.body.result_db;

  getAllWorkflow(dbUrl)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let workflowId = item.id;
        let generatedWorkflowHeaders = await createWorkflowHeaders(workflowId, dbUrl);
        saveResponse = await saveHeaders(generatedWorkflowHeaders, workflowId, resultDbUrl);
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
 * @param {string} dbUrl - databse url.
 *
 * @returns {Array} - generated headers for csv.
 */

const createWorkflowHeaders = function(docId, dbUrl) {
  let workflowHeaders = [];

  return new Promise ((resolve, reject) => {
    retrieveDoc(docId, dbUrl)
      .then(async(data) => {
        let workflowCounts = {
          assessmentCount: 0,
          curriculumCount: 0,
          messageCount: 0
        };

        for (item of data.children) {
          if (item.type === 'assessment') {
            let assessmentHeaders = await createColumnHeaders(item.typesId, workflowCounts.assessmentCount, dbUrl);
            workflowHeaders.push(assessmentHeaders);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumHeaders = await createColumnHeaders(item.typesId, workflowCounts.curriculumCount, dbUrl);
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
 * @param {string} dbUrl - database url.
 *
 * @returns {Array} – all workflow documents.
 */

const getAllWorkflow = function(dbUrl) {
  let BASE_DB = nano(dbUrl);
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
 * @param {string} dbUrl - database url.
 *
 * @returns {Object} - retrieved document.
 */

function retrieveDoc(docId, dbUrl) {
  let BASE_DB = nano(dbUrl);
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

exports.createWorkflowHeaders = createWorkflowHeaders;
