/**
 * This file processes the result of an assessment.
 * The processed result will serve as the values for CSV generation.
 *
 * Modules: generateResult, saveResult.
 */

/**
 * Module dependencies
 */

const _ = require('lodash');
const Excel = require('exceljs');
const nano = require('nano');

/**
 * Define value maps for grid and survey values.
 */

const gridValueMap = {
  'correct': '1',
  'incorrect': '0',
  'missing': '.',
  'skipped': '999',
  'logicSkipped': '999'
};

const surveyValueMap = {
  'checked': '1',
  'unchecked': '0',
  'not asked' : '.',
  'skipped': '999',
  'logicSkipped': '999'
};

/**
 * Retrieves all result collection in the database.
 *
 * Example:
 *
 *    POST /result
 *
 *  The request object must contain the database url
 *       {
 *         "db_url": "http://admin:password@test.tangerine.org/database_name"
 *       }
 *
 * Response:
 *
 *  Returns an Array of objects of result collections.
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
 *          "assessmentName": "Test Result"
 *          "subtestData": [
 *            {
 *              "name": "I am a location data"
 *              "data": {}
 *           },
 *            {
 *              "name": "just a datetime subtest prototype"
 *              "data": {}
 *            }
 *          ]
 *        	"collection": "result"
 *        }
 *      },
 *      ...
 *    ]
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.all = (req, res) => {
  getAllResult(req.body.base_db)
    .then((data) => res.json(data))
    .catch((err) => res.json(Error(err)))
}

/**
 * Processes result for an assessment and saves it in the database.
 *
 * Example:
 *
 *    POST /assessment/result/:id
 *
 *  where id refers to the id of the result document.
 *
 *  The request object must contain the main database url and a
 *  result database url where the processed result will be saved.
 *
 * Request:
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
 *      }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.processResult = (req, res) => {
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;
  const docId = req.params.id;

  retrieveDoc(docId, dbUrl)
    .then((data) => {
      let collectionId = data.assessmentId || data.curriculumId;
      return generateResult(collectionId, 0, dbUrl);
    })
    .then(async(result) => {
      const saveResponse = await saveResult(result, docId, resultDbUrl);
      res.json(saveResponse);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * Process results for ALL assessments in a database
 * and save them in a different database.
 *
 * Example:
 *
 *    POST /assessment/result/_all
 *
 *  The request object must contain the main database url and a
 *  result database url where the generated header will be saved.
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
 *      }
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.processAll = (req, res) => {
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;

  getAllResult(dbUrl)
    .then(async(data) => {
      let saveResponse;

      for(item of data) {
        let docId = item.assessmentId || item.curriculumId;
        let ref = item._id;
        let processedResult = await generateResult(docId, 0, dbUrl);
        saveResponse = await saveResult(processedResult, ref, resultDbUrl);
      }
      res.json(saveResponse);
    })
    .catch((err) => res.send(Error(err)))
}


/************************
 *  APPLICATION MODULE  *
 ************************
*/


/**
 * This function processes the result for an assessment.
 * @param {string} docId - assessment id.
 * @param {number} count - count
 * @param {string} dbUrl - database url.
 * @returns {Object} - processed result for csv.
 */

const generateResult = function(docId, count = 0, dbUrl) {
  let result = {};

  return new Promise ((resolve, reject) => {
    getInChunks(docId, dbUrl)
      .then((collections) => {
        let assessmentSuffix = count > 0 ? `_${count}` : '';

        for (data of collections) {
          result[`${data.doc.assessmentId}.assessmentId${assessmentSuffix}`] = data.doc.assessmentId;
          result[`${data.doc.assessmentId}.assessmentName${assessmentSuffix}`] = data.doc.assessmentName;
          result[`${data.doc.assessmentId}.enumerator${assessmentSuffix}`] = data.doc.enumerator;
          result[`${data.doc.assessmentId}.start_time${assessmentSuffix}`] = data.doc.start_time;
          result[`${data.doc.assessmentId}.order_map${assessmentSuffix}`] = data.doc.order_map ? data.doc.order_map.join(',') : '';

          let subtestCounts = {
            locationCount: 0,
            datetimeCount: 0,
            idCount: 0,
            consentCount: 0,
            gpsCount: 0,
            cameraCount: 0,
            surveyCount: 0,
            gridCount: 0,
            timestampCount: 0
          };

          for (doc of data.doc.subtestData) {
            if (doc.prototype === 'location') {
              let location = processLocationResult(doc, subtestCounts);
              result = _.assignIn(result, location);
              subtestCounts.locationCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'datetime') {
              let datetime = processDatetimeResult(doc, subtestCounts);
              result = _.assignIn(result, datetime);
              subtestCounts.datetimeCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'consent') {
              let consent = processConsentResult(doc, subtestCounts);
              result = _.assignIn(result, consent);
              subtestCounts.consentCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'id') {
              let id = processIDResult(doc, subtestCounts);
              result = _.assignIn(result, id);
              subtestCounts.idCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'survey') {
              let survey = processSurveyResult(doc, subtestCounts);
              result = _.assignIn(result, survey);
              subtestCounts.surveyCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'grid') {
              let grid = processGridResult(doc, subtestCounts);
              result = _.assignIn(result, grid);
              subtestCounts.gridCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'gps') {
              let gps = processGpsResult(doc, subtestCounts);
              result = _.assignIn(result, gps);
              subtestCounts.gpsCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'camera') {
              let camera = processCamera(doc, subtestCounts);
              result = _.assignIn(result, camera);
              subtestCounts.cameraCount++;
              subtestCounts.timestampCount++;
            }
            if (doc.prototype === 'complete') {
              result[`${data.doc.assessmentId}.end_time${assessmentSuffix}`] = doc.data.end_time;
            }
          }
        }
        resolve(result);
      })
      .catch((err) => reject(err));
  });
}


/********************************************
 *    HELPER FUNCTIONS FOR DATABASE QUERY   *
 ********************************************
*/


/**
 * This function retrieves all result collection in the database.
 *
 * @param {string} dbUrl - database url.
 *
 * @returns {Array} – all result documents.
 */

const getAllResult = function(dbUrl) {
  const BASE_DB = nano(dbUrl);
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'csvRows', {
      include_docs: true
    }, (err, body) => {
      if (err) {
        reject(err);
      }
      let resultCollection = _.map(body.rows, (data) => data.doc);
      resolve(resultCollection);
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
  const BASE_DB = nano(dbUrl);
  return new Promise ((resolve, reject) => {
    BASE_DB.get(docId, (err, body) => {
      if (err) {
        reject(err);
      }
      resolve(body)
    });
  });
}

/**
 * This function saves/updates a document in the database.
 *
 * @param {Array} doc - document to be saved.
 * @param {string} key - key for indexing.
 * @param {string} dbUrl - url of the result database.
 *
 * @returns {Object} - saved document.
 */

const saveResult = function(doc, key, dbUrl) {
  const RESULT_DB = nano(dbUrl);
  return new Promise((resolve, reject) => {
    RESULT_DB.get(key, (error, existingDoc) => {
      let docObj = { processed_results: doc };
      // if doc exists update it using its revision number.
      if (!error) {
        docObj._rev = existingDoc._rev;
      }
      RESULT_DB.insert(docObj, key, (err, body) => {
        if (err) {
          reject(err);
        }
        resolve(body);
      })
    });
  });
}

/**
 * This function retrieves a result document.
 *
 * @param {string} docId - id of document.
 * @param {string} dbUrl - database url.
 * @param {number} queryLimit - number of documents to be retrieved.
 * @param {number} skip - number of documents to be skipped.
 *
 * @returns {Object} - result documents.
 */

function getResultById(docId, dbUrl, queryLimit = 0, skip = 0) {
  const BASE_DB = nano(dbUrl);
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'csvRows', {
      limit: queryLimit,
      skip: skip,
      include_docs: true
    }, (err, body) => {
      if (err) {
        reject(err);
      }
      let resultCollection = _.filter(body.rows, (data) => data.doc.assessmentId === docId);
      resolve({ offset: body.offset, totalRows: body.total_rows, resultCollection });
    });
  })
}

/**
 * This function retrieves result document in batches
 *
 * @param {string} docId - id of document.
 * @param {string} dbUrl - database url.
 *
 * @returns {Array} - result documents.
 */

async function getInChunks(docId, dbUrl) {
  let queryLimit = 1000;
  let firstResult = await getResultById(docId, dbUrl, queryLimit);
  let lastPage = Math.floor(firstResult.totalRows / queryLimit) + (firstResult.totalRows % queryLimit);

  if (firstResult.resultCollection.length === 0) {
    let count = 0;
    let view = (firstResult.offset / queryLimit) + 1;
    let skip = queryLimit * view;

    for (count; count <= lastPage; count++) {
      skip = queryLimit + skip;
      let nextResult = await getResultById(docId, dbUrl, queryLimit, skip);
      if (nextResult.resultCollection.length  > 0) {
        return nextResult.resultCollection;
        break;
      }
    }
  } else {
    return firstResult.resultCollection;
  }
}

/**********************************************
 *  HELPER FUNCTIONS FOR PROCESSING RESULTS   *
 *          FOR DIFFERENT PROTOTYPES          *
 **********************************************
*/

/**
 * This function processes result for a location prototype.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed location data.
 */

function processLocationResult(body, subtestCounts) {
  let count = subtestCounts.locationCount;
  let i, locationResult = {};
  let locSuffix = count > 0 ? `_${count}` : '';
  let labels = body.data.labels;
  let location = body.data.location;
  let subtestId = body.subtestId;

  for (i = 0; i < labels.length; i++) {
    let key = `${subtestId}.${labels[i].toLowerCase()}${locSuffix}`
    locationResult[key] = location[i].toLowerCase();
  }
  locationResult[`${subtestId}.timestamp_${subtestCounts.timestampCount}`] = doc.timestamp;

  return locationResult;
}

/**
 * This function processes result for a datetime prototype.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed datetime data.
 */

function processDatetimeResult(body, subtestCounts) {
  let count = subtestCounts.datetimeCount;
  let suffix = count > 0 ? `_${count}` : '';
  datetimeResult = {
    [`${body.subtestId}.year${suffix}`]: body.data.year,
    [`${body.subtestId}.month${suffix}`]: body.data.month,
    [`${body.subtestId}.day${suffix}`]: body.data.day,
    [`${body.subtestId}.assess_time${suffix}`]: body.data.time,
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: body.timestamp
  }
  return datetimeResult;
}

/**
 * This function processes a consent prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed consent data.
 */

function processConsentResult(body, subtestCounts) {
  let count = subtestCounts.consentCount;
  let suffix = count > 0 ? `_${count}` : '';
  consentResult = {
    [`${body.subtestId}.consent${suffix}`]: body.data.consent,
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: body.timestamp
  };
  return consentResult;
}

/**
 * This function processes an id prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed id data.
 */

function processIDResult(body, subtestCounts) {
  let count = subtestCounts.idCount;
  let suffix = count > 0 ? `_${count}` : '';
  idResult = {
    [`${body.subtestId}.id${suffix}`]: body.data.participant_id,
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: body.timestamp
  };
  return idResult;
}

/**
 * This function processes a survey prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed survey data.
 */

function processSurveyResult(body, subtestCounts) {
  let count = subtestCounts.surveyCount;
  let surveyResult = {};

  for (doc in body.data) {
    if (typeof body.data[doc] === 'object') {
      for (item in body.data[doc]) {
        let surveyValue = translateSurveyValue(body.data[doc][item]);
        surveyResult[`${body.subtestId}.${doc}.${item}`] = surveyValue;
      }
    } else {
      let value = translateSurveyValue(body.data[doc]);
      surveyResult[`${body.subtestId}.${doc}`] = value;
    }
  }
  surveyResult[`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`] = body.timestamp;

  return surveyResult;
}

/**
 * This function processes a grid prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed grid data.
 */

function processGridResult(body, subtestCounts) {
  let count = subtestCounts.gridCount;
  let varName = body.data.variable_name || body.name.toLowerCase().replace(/\s/g, '_');
  let subtestId = body.subtestId;
  let gridResult = {};
  let suffix = count > 0 ? `_${count}` : '';

  gridResult[`${subtestId}.${varName}_auto_stop${suffix}`] = body.data.auto_stop;
  gridResult[`${subtestId}.${varName}_time_remain${suffix}`] = body.data.time_remain;
  gridResult[`${subtestId}.${varName}_capture_item_at_time${suffix}`] = body.data.capture_item_at_time;
  gridResult[`${subtestId}.${varName}_attempted${suffix}`] = body.data.attempted;
  gridResult[`${subtestId}.${varName}_time_intermediate_captured${suffix}`] = body.data.time_intermediate_captured;
  gridResult[`${subtestId}.${varName}_time_allowed${suffix}`] = body.data.time_allowed;

  for (doc of body.data.items) {
    let gridValue = translateGridValue(doc.itemResult);
    gridResult[`${subtestId}.${varName}_${doc.itemLabel}`] = gridValue;
  }
  gridResult[`${subtestId}.timestamp_${subtestCounts.timestampCount}`] = body.timestamp;

  return gridResult;
}

/**
 * This function processes a gps prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed gps data.
 */

function processGpsResult(doc, subtestCounts) {
  let count = subtestCounts.gpsCount;
  let gpsResult = {};
  let suffix = count > 0 ? `_${count}` : '';

  gpsResult[`${doc.subtestId}.latitude${suffix}`] = doc.data.lat;
  gpsResult[`${doc.subtestId}.longitude${suffix}`] = doc.data.long;
  gpsResult[`${doc.subtestId}.altitude${suffix}`] = doc.data.alt;
  gpsResult[`${doc.subtestId}.accuracy${suffix}`] = doc.data.acc;
  gpsResult[`${doc.subtestId}.altitudeAccuracy${suffix}`] = doc.data.altAcc;
  gpsResult[`${doc.subtestId}.heading${suffix}`] = doc.data.heading;
  gpsResult[`${doc.subtestId}.speed${suffix}`] = doc.data.speed;
  gpsResult[`${doc.subtestId}.timestamp_${subtestCounts.timestampCount}`] = doc.data.timestamp;

  return gpsResult;
}

/**
 * This function processes a camera prototype subtest data.
 *
 * @param {Object} body - document to be processed.
 * @param {Object} subtestCounts - count.
 *
 * @returns {Object} processed camera data.
 */

function processCamera(body, subtestCounts) {
  let count = subtestCounts.cameraCount;
  let cameraResult = {};
  let varName = body.data.variableName;
  let suffix = count > 0 ? `_${count}` : '';

  cameraResult[`${body.subtestId}.${varName}_photo_captured${suffix}`] = body.data.imageBase64;
  cameraResult[`${body.subtestId}.${varName}_photo_url${suffix}`] = body.data.imageBase64;
  cameraResult[`${body.subtestId}.timestamp_${subtestsCount.timestampCount}`] = body.timestamp;

  return cameraResult;
}

/**
 * This function maps a value in a result doc to a
 * value that will be represented in a csv file.
 *
 * @param {string} databaseValue - result value to be mapped.
 *
 * @returns {string} - translated survey value.
 */

function translateSurveyValue(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return surveyValueMap[databaseValue] || String(databaseValue);
};

/**
 * This function maps a value in a result doc to a
 * value that will be represented in a csv file.
 *
 * @param {string} databaseValue - result value to be mapped.
 *
 * @returns {string} - translated grid value.
 */

function translateGridValue(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return gridValueMap[databaseValue] || String(databaseValue);
};

exports.generateResult = generateResult;

exports.saveResult = saveResult;
