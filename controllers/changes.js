/**
 * This file implements couch DB changes features.
 * It watches for any changes in the database and
 * processes the changed document based on its collection type.
 */

/**
 * Module Dependencies.
 */

const _ = require('lodash');
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
  const dbUrl = req.body.base_db || dbConfig.base_db;
  const resultDbUrl = req.body.result_db || dbConfig.result_db;
  const BASE_DB = nano(dbUrl);
  const feed = BASE_DB.follow({ since: 'now', include_docs: true });

  feed.on('change', async(resp) => {
    feed.pause();
    processChangedDocument(resp, dbUrl, resultDbUrl);
    setTimeout(function() { feed.resume() }, 500);
  });

  feed.on('error', (err) => res.send(err));
  feed.follow();
}

const processChangedDocument = async(resp, dbUrl, resultDbUrl) => {
  const assessmentId = resp.doc.assessmentId;
  const workflowId = resp.doc.workflowId;
  const collectionType = resp.doc.collection;

  const isWorkflowIdSet = (workflowId) ? true : false;
  const isResult = (collectionType === 'result') ? true : false;
  const isWorkflow = (collectionType === 'workflow') ? true : false;
  const isAssessment = (collectionType === 'assessment') ? true : false;
  const isCurriculum = (collectionType === 'curriculum') ? true : false;
  const isQuestion = (collectionType === 'question') ? true : false;
  const isSubtest = (collectionType === 'subtest') ? true : false;

  console.info(`\n::: Processing ${collectionType} document on sequence ${resp.seq} :::\n`);

  if (isWorkflowIdSet && isResult) {
    console.info('\n<<<=== START PROCESSING WORKFLOW RESULT ===>>>\n');
    dbQuery.getResults(resp.doc.tripId, dbUrl)
      .then(async(data) => {
        const workflowResult = await processWorkflowResult(data, dbUrl);
        const saveResponse = await dbQuery.saveResult(workflowResult, resultDbUrl);
        console.log(saveResponse);
        console.info('\n<<<=== END PROCESSING WORKFLOW RESULT ===>>>\n');
      })
      .catch((err) => console.error(err));
  }

  if (!isWorkflowIdSet && isResult) {
    console.info('\n<<<=== START PROCESSING ASSESSMENT RESULT  ===>>>\n');
    let assessmentResult = await processAssessmentResult([resp], 0, dbUrl);
    let docId = assessmentResult.indexKeys.collectionId;
    let groupTimeZone = assessmentResult.indexKeys.groupTimeZone;
    let allTimestamps = _.sortBy(assessmentResult.indexKeys.timestamps);

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
  }

  if (isWorkflow) {
    console.info('\n<<<=== START PROCESSING WORKFLOW COLLECTION  ===>>>\n');
    const workflowHeaders = await generateWorkflowHeaders(resp.doc, dbUrl);
    const saveResponse = await dbQuery.saveHeaders(workflowHeaders, workflowId, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING WORKFLOW COLLECTION ===>>>\n');
  }

  if (isAssessment || isCurriculum || isQuestion || isSubtest) {
    console.info('\n<<<=== START PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION  ===>>>\n');
    const assessmentHeaders = await generateAssessmentHeaders(resp.doc, 0, dbUrl);
    const saveResponse = await dbQuery.saveHeaders(assessmentHeaders, assessmentId, resultDbUrl);
    console.log(saveResponse);
    console.info('\n<<<=== END PROCESSING ASSESSMENT or CURRICULUM or SUBTEST or QUESTION COLLECTION ===>>>\n');
  }

}

exports.processChangedDocument = processChangedDocument;
