/**
 * This file implements couch DB changes features.
 * It watches for any changes in the database and
 * processes the changed document based on its collection type.
 */

/**
 * Module Dependencies.
 */


const sortBy = require('lodash').sortBy;
const nano = require('nano');

/**
 * Local Depencies.
 */

const dbConfig = require('./../config');
const dbQuery = require('./../utils/dbQuery');
const generateAssessmentHeaders = require('./assessment').createColumnHeaders;
const processAssessmentResult = require('./result').generateResult;
const generateWorkflowHeaders = require('./workflow').createWorkflowHeaders;
const processWorkflowResult = require('./trip').processWorkflowResult;
const validateResult = require('./result').validateResult;

/**
 * Processes any recently changed document in the database based on its collection type.
 *
 * Example:
 *
 *    POST /tangerine_changes
 *
 *  The request object must contain the database url and the result database url.
 *       {
 *         "db_url": "http://admin:password@test.tangerine.org/database_name"
 *         "another_db_url": "http://admin:password@test.tangerine.org/result_database_name"
 *       }
 *
 * Response:
 *
 * Returns the changed document in the database.
 *      {
 *        "seq": 1001,
 *        "id": "e1234567890",
 *        "changes": [
 *            {
 *              "rev": "1-123a"
 *            }
 *        ]
 *      }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.changes = async(req, res) => {
  const dbUrl = req.body.baseDb || dbConfig.baseDb;
  const resultDbUrl = req.body.resultDb || dbConfig.resultDb;
  const BASE_DB = nano(dbUrl);
  const feed = BASE_DB.follow({ since: 'now', include_docs: true });

  feed.on('change', (body) => {
    feed.pause();
    queueProcessChangedDocument({ body, dbUrl, resultDbUrl });
    setTimeout(function() { feed.resume() }, 200);
  });

  feed.on('error', (err) => res.send(err));
  feed.follow();
}

var queue = [];
var isProcessing = false;
const queueProcessChangedDocument = async function(job) {
  queue.push(job);
};

var sleep = delay => {
  return new Promise(res => {
    setTimeout(res, delay);
  });
};

let startQueue = async () => {
  while (true) {
    await sleep(200);
    if (queue.length > 0) {
      let job = queue.shift();
      await processChangedDocument(job.body, job.dbUrl, job.resultDbUrl);
    }
  }
};

startQueue();

/** @description This function processess a document based on the
 * collection type i.e. result, assessment, workflow, subtest, question
 * and curriculum. This is usually called when a change happens in the base
 * database and it is processed and saved in the result database.
 *
 * @param {Object} resp - changed document
 * @param {string} dbUrl - base database url
 * @param {string} resultDbUrl - result database url
 */

const processChangedDocument = async(resp, dbUrl, resultDbUrl) => {
  const assessmentId = resp.doc.assessmentId || resp.doc._id;
  const workflowId = resp.doc.workflowId;
  const collectionType = resp.doc.collection;

  const isWorkflowIdSet = (workflowId) ? true : false;
  const isResult = (collectionType === 'result') ? true : false;
  const isWorkflow = (collectionType === 'workflow') ? true : false;
  const isAssessment = (collectionType === 'assessment') ? true : false;
  const isCurriculum = (collectionType === 'curriculum') ? true : false;
  const isQuestion = (collectionType === 'question') ? true : false;
  const isSubtest = (collectionType === 'subtest') ? true : false;

  console.info(`\n::: Processing document on sequence ${resp.seq} :::\n`);

  if (isWorkflowIdSet && isResult) {
    console.info('\n<<<=== START PROCESSING WORKFLOW RESULT ===>>>\n');
    try {
      let data = await dbQuery.getTripResults(resp.doc.tripId, dbUrl);
      const workflowResult = await processWorkflowResult(data, dbUrl);
      const saveResponse = await dbQuery.saveResult(workflowResult, resultDbUrl);
      console.log(saveResponse);
      console.info('\n<<<=== END PROCESSING WORKFLOW RESULT ===>>>\n');
    } catch (error) {
      console.error(error);
    }
  }

  if (!isWorkflowIdSet && isResult) {
    try {
      console.info('\n<<<=== START PROCESSING ASSESSMENT RESULT  ===>>>\n');
      let assessmentResult = await processAssessmentResult([resp], 0, dbUrl);
      let docId = assessmentResult.indexKeys.collectionId;
      let groupTimeZone = assessmentResult.indexKeys.groupTimeZone;
      let allTimestamps = sortBy(assessmentResult.indexKeys.timestamps);

      // Validate result from all subtest timestamps
      let validationData = await validateResult(docId, groupTimeZone, dbUrl, allTimestamps);
      assessmentResult.isValid = validationData.isValid;
      assessmentResult.isValidReason = validationData.reason;
      assessmentResult[`${docId}.start_time`] = validationData.startTime;
      assessmentResult[`${docId}.end_time`] = validationData.endTime;

      assessmentResult.indexKeys.ref = assessmentResult.indexKeys.ref;
      assessmentResult.indexKeys.parent_id = docId;
      assessmentResult.indexKeys.year = validationData.indexKeys.year;
      assessmentResult.indexKeys.month = validationData.indexKeys.month;
      assessmentResult.indexKeys.day = validationData.indexKeys.day;

      const saveResponse = await dbQuery.saveResult(assessmentResult, resultDbUrl);
      console.log(saveResponse);
      console.info('\n<<<=== END PROCESSING ASSESSMENT RESULT ===>>>\n');
    } catch (err) {
      console.error(err);
    }
  }

  if (isWorkflow) {
    try {
      console.info('\n<<<=== START PROCESSING WORKFLOW COLLECTION  ===>>>\n');
      const docId = workflowId || resp.doc._id;
      const workflowHeaders = await generateWorkflowHeaders(resp.doc, dbUrl);
      const saveResponse = await dbQuery.saveHeaders(workflowHeaders, docId, resultDbUrl);
      console.log(saveResponse);
      console.info('\n<<<=== END PROCESSING WORKFLOW COLLECTION ===>>>\n');
    } catch (err) {
      console.error(err);
    }
  }

  if (isAssessment || isCurriculum || isQuestion || isSubtest) {
    try {
      console.info(`\n<<<=== START PROCESSING ${resp.doc.collection.toUpperCase()} COLLECTION  ===>>>\n`);
      let assessmentDoc = await dbQuery.retrieveDoc(assessmentId, dbUrl);
      const assessmentHeaders = await generateAssessmentHeaders(resp.doc, 0, dbUrl);
      assessmentHeaders.unshift(assessmentDoc.name); // Add assessment name. Needed for csv file name.
      const saveResponse = await dbQuery.saveHeaders(assessmentHeaders, assessmentId, resultDbUrl);
      console.log(saveResponse);
      console.info(`\n<<<=== END PROCESSING ${resp.doc.collection.toUpperCase()} COLLECTION ===>>>\n`);
    } catch (err) {
      console.error(err);
    }
  }

}

exports.processChangedDocument = processChangedDocument;
