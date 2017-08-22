/**
 * This file processes the result of an assessment.
 * The processed result will serve as the values for CSV generation.
 * It also exposes the generateResult and saveResult modules.
 */

/**
 * Module dependencies
 */
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');
const nano = require('nano');

/**
 * Declare database variables
 */
let RESULT_DB, BASE_DB;

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
 * POST /result
 * returns all result collection.
 */
exports.all = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  BASE_DB.list({ limit: 100, include_docs: true }, (err, body) => {
    if (err) res.json(err);
    res.json(body.rows);
  });
}

/**
 * POST /result/:id
 * returns processed result for an assessment.
 */
exports.get = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  RESULT_DB = nano(req.body.result_db);
  let parentId = req.params.id;

  retrieveDoc(parentId)
    .then((data) => {
      return generateResult(data.assessmentId)
    })
    .then((result) => {
      return saveResult(result, parentId, RESULT_DB);
    })
    .then((saved) => {
      res.json(saved);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * This function processes the result for an assessment.
 * @param {string, number, string} [docId, count, dbUrl] assessmentId, count and database url.
 * @returns {Object} processed result for csv.
 */
const generateResult = function(docId, count = 0, dbUrl) {
  let result = {};
  BASE_DB = BASE_DB || nano(dbUrl);

  return new Promise ((resolve, reject) => {
    getResultById(docId)
      .then((collections) => {
        let assessmentSuffix = count > 0 ? `_${count}` : '';
        for (data of collections) {
          result[`${data.assessmentId}.assessmentId${assessmentSuffix}`] = data.assessmentId;
          result[`${data.assessmentId}.assessmentName${assessmentSuffix}`] = data.assessmentName;
          result[`${data.assessmentId}.enumerator${assessmentSuffix}`] = data.enumerator;
          result[`${data.assessmentId}.start_time${assessmentSuffix}`] = data.start_time;
          result[`${data.assessmentId}.order_map${assessmentSuffix}`] = data.order_map ? data.order_map.join(',') : '';

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

          for (doc of data.subtestData) {
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
              result[`${data.assessmentId}.end_time${assessmentSuffix}`] = doc.data.end_time;
            }
          }
        }
        resolve(result);
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

/**
 * This function inserts a document in the database.
 * @param {string, string, string} [docs, key, resultDB] document, key and database.
 * @returns {Object} saved document.
 */
const saveResult = function(docs, key, resultDB) {
  return new Promise((resolve, reject) => {
    resultDB.insert({ processed_results: docs }, key, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

/**
 * This function retrieves a result document.
 * @param {string} docId id of document.
 * @returns {Array} result documents.
 */
function getResultById(docId) {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'csvRows', { limit: 100, include_docs: true }, (err, body) => {
      if (err) reject(err);
      let resultCollection = [];
      _.filter(body.rows, (data) => {
        if (data.doc.assessmentId === docId) {
          resultCollection.push(data.doc);
        }
      });
      resolve(resultCollection);
    });
  })

}

/**
 * This function processes result for a location prototype.
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * @param {Object, Object} [body, subtestCounts] document to be processed and the count.
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
 * This function maps survey result to a survey map value.
 * @param {string} databaseValue result value to be mapped.
 * @returns {string} translated survey value.
 */
function translateSurveyValue(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return surveyValueMap[databaseValue] || String(databaseValue);
};

/**
 * This function maps grid result to a grid map value.
 * @param {string} databaseValue result value to be mapped.
 * @returns {string} translated grid value.
 */
function translateGridValue(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return gridValueMap[databaseValue] || String(databaseValue);
};

exports.generateResult = generateResult;

exports.saveResult = saveResult;
