// Module dependencies.
const _ = require('lodash');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const createHeaders = require('./assessment').createColumnHeaders;
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
 * GET /assessment/:id
 * return all headers and keys for a particular assessment
 */
exports.get = (req, res) => {
  let workflow_id = req.params.id;
  createWorkflow(workflow_id)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

// Create workflow headers and workflow results
const createWorkflow = function(docId) {
  let workflowHeaders = [];
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
            let assessmentHeaders = await createHeaders(item.typesId, workflowCounts.assessmentCount);
            let assessmentResults = await processResult(item.typesId, workflowCounts.assessmentCount);
            workflowHeaders.push(assessmentHeaders);
            workflowResults = _.assignIn(workflowResults, assessmentResults);
            workflowCounts.assessmentCount++;
          }
          if (item.type === 'curriculum') {
            let curriculumHeaders = await createHeaders(item.typesId, workflowCounts.curriculumCount);
            let curriculumResults = await processResult(item.typesId, workflowCounts.curriculumCount);
            workflowHeaders.push(curriculumHeaders);
            workflowResults = _.assignIn(workflowResults, curriculumResults);
            workflowCounts.curriculumCount++;
          }
          if (item.type === 'message') {
            let messageSuffix = workflowCounts.messageCount > 0 ? `_${workflowCounts.messageCount}` : '';
            workflowHeaders.push({ headers: `${docId}_message${messageSuffix}`, key: `${docId}.message${messageSuffix}`});
            let messageKey = `${docId}.message${messageSuffix}`;
            workflowResults = _.assignIn(workflowResults, { [messageKey]: item.message });
            workflowCounts.messageCount++;
          }
        }
        workflowHeaders = _.flatten(workflowHeaders);

        await saveHeaders(workflowHeaders, docId);  // Save headers
        await saveResult(workflowResults, docId);   // Save processed results

        resolve({ workflowHeaders, workflowResults });
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

// Retrieve a particular workflow collection
function getWorkflowById(docId) {
  return new Promise ((resolve, reject) => {
    TAYARI_BACKUP.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}
