// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');
const nano = require('nano');

const generateAssessmentHeaders = require('./assessment').createColumnHeaders;
const processAssessmentResult = require('./result').generateResult;
const generateWorkflowHeaders = require('./workflow').createWorkflowHeaders;
const processWorkflowResult = require('./workflow').processWorkflowResult;

let BASE_DB;

/**
 * GET /tangerine_changes
 * process headers and result of changed document
*/
exports.changes = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  const feed = BASE_DB.follow({ since: 'now', include_docs:true });

  feed.on('change', (resp) => {
    let isWorkflowIdSet = (resp.doc.doc.workflowId) ? true : false;
    let isResult = (resp.doc.doc.collection === 'result') ? true : false;
    let isWorkflow = (resp.doc.doc.collection === 'workflow') ? true : false;
    let isAssessment = (resp.doc.doc.collection === 'assessment') ? true : false;
    let isCurriculum = (resp.doc.doc.collection === 'curriculum') ? true : false;
    let isQuestion = (resp.doc.doc.collection === 'question') ? true : false;
    let isSubtest = (resp.doc.doc.collection === 'subtest') ? true : false;

    if (isWorkflowIdSet && isResult) {
      processWorkflowResult(resp.doc.doc.workflowId);
    }
     if (isWorkflowIdSet && isWorkflow) {
      generateWorkflowHeaders(resp.doc.doc.workflowId);
    }
    if (!isWorkflowIdSet && isResult) {
      processAssessmentResult(resp.doc.doc.assessmentId);
    }
    if (isAssessment || isCurriculum || isQuestion || isSubtest) {
      generateAssessmentHeaders(resp.doc.doc.assessmentId);
    }
    res.json(resp);
  });

  feed.on('error', (err) => res.send(Error(err)));

  feed.follow();
}
