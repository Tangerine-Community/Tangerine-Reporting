// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINE = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const generateAssessmentHeaders = require('./assessment').createColumnHeaders;
const processAssessmentResult = require('./result').generateResult;
const generateWorkflowHeaders = require('./workflow').createWorkflowHeaders;
const processWorkflowResult = require('./workflow').processWorkflowResult;


// TODO: Remove sample doc before live data testing
const sampleDoc =  {
  "_id": "9adc36fa8cba4c7511a0bc3e7c00b",
  "assessmentId": "a9468e01-6b3e-2fb5-1b47-2fa2cb1d4190",
  "assessmentName": "During Obsevation Tool - Sub-County ECD Coordinator Observation",
  "tripId": "a6aa892c-5c24-0be3-8fb4-628418150e6d",
  "workflowId": "9e91640d-b308-38f6-eef5-baf17b4bafa8",
  "subtestData": [],
  "start_time": 1455689463600,
  "enumerator": "stevenochieng",
  "tscNumber": "233",
  "tangerine_version": "1.7.1",
  "instanceId": "aaaa-bbbb-cccc",
  "editedBy": "stevenochieng",
  "updated": "Wed Feb 17 2016 09:40:36 GMT+0300 (EAT)",
  "hash": "w8Ec4SGYMIyZHrx0gcz4issM7hM=",
  "fromInstanceId": "aaaa-bbbb-cccc",
  "collection": "result"
}

/**
 * GET /tangerine_changes
 * process headers and result of changed document
*/
exports.changes = (req, res) => {
  const feed = TMP_TANGERINE.follow({ since: 'now', include_docs:true });

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

  // TODO: Remove this before life testing
  process.nextTick( () => {
    sampleDoc._id = sampleDoc._id + Math.floor(Math.random() * 2000);
    TMP_TANGERINE.insert({ doc: sampleDoc },  sampleDoc._id, (err, body) => {
      console.log('saved ====::', body);
    });
  });
}

// TODO: Decide to keep or remove this
function retrieveChangeDoc(docId) {
  return new Promise((resolve, reject) => {
    TMP_TANGERINE.get(docId, (err, body) => {
      if(err) reject(err);
      resolve(body);
    })
  });
}
