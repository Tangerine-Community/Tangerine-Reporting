// Module dependencies.
const _ = require('lodash');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const generateHeaders = require('./assessment').createColumnHeaders;
const saveHeaders = require('./assessment').saveHeaders;
const processResult = require('./result').generateResult;
const saveResult = require('./result').saveResult;

/**
 * GET /workflow
 * return all workflow assessments
 */
exports.all = (req, res) => {
  TAYARI_BACKUP
    .view('ojai', 'byCollection', {
      key: 'workflow',
      include_docs: true
    }, (err, body) => {
      if (err) res.send(err);
      res.json(body.rows)
    });
}

/**
 * GET /workflow/headers/:id
 * return headers and keys for a particular workflow
 */
exports.getHeaders = (req, res) => {
  let workflowId;
  retrieveDoc(req.params.id)
    .then((doc) => {
      workflowId = doc.workflowId;
      return createWorkflowHeaders(workflowId);
    })
    .then((colHeaders) => {
      return saveHeaders(colHeaders, workflowId);
    })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

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

// Create workflow headers
const createWorkflowHeaders = function(docId) {
  let workflowHeaders = [];

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
            let assessmentHeaders = await generateHeaders(item.typesId, workflowCounts.assessmentCount);
            workflowHeaders.push(assessmentHeaders);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumHeaders = await generateHeaders(item.typesId, workflowCounts.curriculumCount);
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

// Retrieve all workflow collection
function getAllWorkflow(docId) {
  return new Promise ((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'byCollection', {
        key: 'workflow',
        limit: 100,
        include_docs: true
      }, (err, body) => {
        if (err) reject(err);
        resolve(body.rows)
      });
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

exports.createWorkflowHeaders = createWorkflowHeaders;

exports.processWorkflowResult = processWorkflowResult;

