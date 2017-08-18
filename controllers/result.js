//  Module dependencies
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINE = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

gridValueMap = {
  'correct': '1',
  'incorrect': '0',
  'missing': '.',
  'skipped': '999',
  'logicSkipped': '999'
}

surveyValueMap = {
  'checked': '1',
  'unchecked': '0',
  'not asked' : '.' ,
  'skipped': '999',
  'logicSkipped': '999'
}

/**
 * GET /result
 * return all results collection
 */
exports.all = (req, res) => {
  TAYARI_BACKUP
    .list({ limit: 100, include_docs: true }, (err, body) => {
      if (err) res.json(err);
      res.json(body.rows);
    });
}

/**
 * GET /result/:id
 * return result for a particular assessment id
 */
exports.get = (req, res) => {
  let parentId = req.params.id;
  retrieveDoc(parentId)
    .then((data) => {
      return generateResult(data.assessmentId)
    })
    .then((result) => {
      return saveResult(result, parentId);
    })
    .then((saved) => {
      res.json(saved);
    })
    .catch((err) => res.send(Error(err)));
}

const generateResult = function(docId, count = 0) {
  let result = {};
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

// Retrieve document by id
function retrieveDoc(docId) {
  return new Promise ((resolve, reject) => {
    TAYARI_BACKUP.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body)
    });
  });
}

// Save doc into result DB
const saveResult = function(docs, key) {
  return new Promise((resolve, reject) => {
    RESULT_DB.insert({ processed_results: docs }, key, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

// Get result collection by assessment id
function getResultById(docId) {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'csvRows', { limit: 100, include_docs: true }, (err, body) => {
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

// Generate location prototype result
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

// Generate datetime prototype result
function processDatetimeResult(doc, subtestCounts) {
  let count = subtestCounts.datetimeCount;
  let suffix = count > 0 ? `_${count}` : '';
  datetimeResult = {
    [`${doc.subtestId}.year${suffix}`]: doc.data.year,
    [`${doc.subtestId}.month${suffix}`]: doc.data.month,
    [`${doc.subtestId}.day${suffix}`]: doc.data.day,
    [`${doc.subtestId}.assess_time${suffix}`]: doc.data.time,
    [`${doc.subtestId}.timestamp_${subtestCounts.timestampCount}`]: doc.timestamp
  }
  return datetimeResult;
}

// Generate result for consent prototype
function processConsentResult(body, subtestCounts) {
  let count = subtestCounts.consentCount;
  let suffix = count > 0 ? `_${count}` : '';
  consentResult = {
    [`${body.subtestId}.consent${suffix}`]: body.data.consent,
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: body.timestamp
  };
  return consentResult;
}

// Generate result for ID prototype
function processIDResult(body, subtestCounts) {
  let count = subtestCounts.idCount;
  let suffix = count > 0 ? `_${count}` : '';
  idResult = {
    [`${body.subtestId}.id${suffix}`]: body.data.participant_id,
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: body.timestamp
  };
  return idResult;
}

// Generate result for survey prototype
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

// Generate result for grid prototype
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

// Generate result for GPS prototype
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

// Generate result for Camera prototype
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

translateSurveyValue = function(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return surveyValueMap[databaseValue] || String(databaseValue);
};

translateGridValue = function(databaseValue) {
  if (databaseValue == null) {
    databaseValue = 'no_record';
  }
  return gridValueMap[databaseValue] || String(databaseValue);
};

exports.generateResult = generateResult;

exports.saveResult = saveResult;
