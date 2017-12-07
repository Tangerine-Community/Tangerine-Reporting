/**
 * This file processes the result of an assessment.
 * The processed result will serve as the values for CSV generation.
 *
 * Module: generateResult.
 */

/**
 * Module dependencies.
 */

const _ = require('lodash');
const nano = require('nano');
const moment = require('moment');
moment().format();

/**
 * Local dependencies.
 */

const dbQuery = require('./../utils/dbQuery');

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
  'not asked': '.',
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
  dbQuery.getAllResult(req.body.base_db)
    .then((data) => res.json(data))
    .catch((err) => res.json(Error(err)));
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

  dbQuery.retrieveDoc(docId, dbUrl)
    .then(async(data) => {
      let resultDoc = { doc: data };
      const result = await generateResult(resultDoc, 0, dbUrl);
      const saveResponse = await dbQuery.saveResult(result, resultDbUrl);
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

  dbQuery.getAllResult(dbUrl)
    .then(async(data) => {
      let saveResponse;
      for (item of data) {
        let docId = item.assessmentId || item.curriculumId;
        let ref = item._id;
        let processedResult = await generateResult(docId, 0, dbUrl);
        saveResponse = await dbQuery.saveResult(processedResult, ref, resultDbUrl);
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
 *
 * @param {string} docId - assessment id.
 * @param {number} count - count
 * @param {string} dbUrl - database url.
 *
 * @returns {Object} - processed result for csv.
 */

const generateResult = async function(collections, count = 0, dbUrl) {
  let enumeratorName;
  let result = {};
  let indexKeys = {};
  let assessmentSuffix = count > 0 ? `_${count}` : '';
  let resultCollections = _.isArray(collections) ? collections : [collections];

  for (let [index, data] of resultCollections.entries()) {
    let collection = data.doc;
    let collectionId = collection.workflowId || collection.assessmentId || collection.curriculumId;
    enumeratorName = collection.enumerator;

    if (index === 0) {
      indexKeys.parent_id = collectionId;
      indexKeys.ref = collection.workflowId ? collection.tripId : collection._id;
      indexKeys.year = moment(collection.start_time).year();
      indexKeys.month = moment(collection.start_time).format('MMM');
      indexKeys.day = moment(collection.start_time).day();
      indexKeys.time = moment(collection.start_time).format('hh:mm');
      result.indexKeys = indexKeys;
    }

    result.isValid = validateResult(collection);
    result[`${collectionId}.assessmentId${assessmentSuffix}`] = collectionId;
    result[`${collectionId}.assessmentName${assessmentSuffix}`] = collection.assessmentName;
    result[`${collectionId}.enumerator${assessmentSuffix}`] = collection.enumerator;
    result[`${collectionId}.start_time${assessmentSuffix}`] = moment(collection.start_time).format('hh:mm');
    result[`${collectionId}.order_map${assessmentSuffix}`] = collection.order_map ? collection.order_map.join(',') : '';

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

    let subtestData = _.isArray(collection.subtestData) ? collection.subtestData : [collection.subtestData];

    for (doc of subtestData) {
      if (doc.prototype === 'location') {
        let location = await processLocationResult(doc, subtestCounts, dbUrl);
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
        result[`${collectionId}.end_time${assessmentSuffix}`] = moment(doc.data.end_time).format('hh:mm');
      }
    }
  }

  let username = `user-${enumeratorName}`;
  let userDetails = await dbQuery.getUserDetails(username, dbUrl);
  result.userRole = userDetails.role;
  result.mPesaNumber = userDetails.mPesaNumber;
  result.phoneNumber = userDetails.phoneNumber;
  result.fullName = `${userDetails.firstName} ${userDetails.lastName}`;

  return result;
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

async function processLocationResult(body, subtestCounts, dbUrl) {
  let count = subtestCounts.locationCount;
  let i, locationResult = {};
  let locSuffix = count > 0 ? `_${count}` : '';
  let locLabels = body.data.labels;
  let location = body.data.location;
  let subtestId = body.subtestId;
  let locationNames = await getLocationName(location, dbUrl);

  locationResult[`${subtestId}.county${locSuffix}`] = locationNames.county.label;
  locationResult[`${subtestId}.subcounty${locSuffix}`] = locationNames.subcounty.label;
  locationResult[`${subtestId}.zone${locSuffix}`] = locationNames.zone.label;
  locationResult[`${subtestId}.school${locSuffix}`] = locationNames.school.label;
  locationResult[`${subtestId}.timestamp_${subtestCounts.timestampCount}`] = moment(doc.timestamp).format('hh:mm');

  return locationResult;
}

/**
 * @description – This function retrieves the county,
 * subcounty, zone and school data from the location list.
 *
 * @param {array} location - An array of location id.
 * @param {string} dbUrl - database base url.
 *
 * @returns {object} - An object containing the county,
 *  subcounty, zone & school data.
 */

async function getLocationName(location, dbUrl) {
  let county, subcounty, zone, school;

  // retrieve location-list from the base database.
  let locationList = await dbQuery.getLocationList(dbUrl);

  // grab county data from location-list
  county = _.get(locationList.locations, location[0]);

  // iterate over county data to grab zone, subcounty and school data.
  for (let [subcountyKey, subcountyVal] of Object.entries(county.children)) {
    zone =  _.get(subcountyVal.children, location[1]);
    if (zone) {
      // if we got here it means "subcountyVal" is the subcounty data.
      // This is because most location id doesn't always contain the subcounty id.
      subcounty = subcountyVal;
      school = _.get(zone.children, location[2]);
      break;
    }
  }
  return { county, subcounty, zone, school }
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
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: moment(body.timestamp).format('hh:mm')
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
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: moment(body.timestamp).format('hh:mm')
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
    [`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`]: moment(body.timestamp).format('hh:mm')
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
  let response = [];

  for (doc in body.data) {
    if (typeof body.data[doc] === 'object') {
      for (item in body.data[doc]) {
        let surveyValue = translateSurveyValue(body.data[doc][item]);
        response.push(surveyValue);
        surveyResult[`${body.subtestId}.${doc}`] = response.join(',');
      }
    } else {
      let value = translateSurveyValue(body.data[doc]);
      surveyResult[`${body.subtestId}.${doc}`] = value;
    }
  }
  // TODO: Uncomment when we confirm we need this.
  // let correctPercent = Math.round(100 * body.sum.correct / body.sum.total);
  // surveyResult[`${body.subtestId}.correct_percentage`] = `${correctPercent}%`
  surveyResult[`${body.subtestId}.timestamp_${subtestCounts.timestampCount}`] = moment(body.timestamp).format('hh:mm');

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
  let total = body.data.items.length;
  let correctSum = 0;

  gridResult[`${subtestId}.${varName}_auto_stop${suffix}`] = body.data.auto_stop;
  gridResult[`${subtestId}.${varName}_time_remain${suffix}`] = body.data.time_remain;
  gridResult[`${subtestId}.${varName}_capture_item_at_time${suffix}`] = body.data.capture_item_at_time;
  gridResult[`${subtestId}.${varName}_attempted${suffix}`] = body.data.attempted;
  gridResult[`${subtestId}.${varName}_time_intermediate_captured${suffix}`] = body.data.time_intermediate_captured;
  gridResult[`${subtestId}.${varName}_time_allowed${suffix}`] = body.data.time_allowed;

  for (doc of body.data.items) {
    let gridValue = translateGridValue(doc.itemResult);
    gridResult[`${subtestId}.${varName}_${doc.itemLabel}`] = gridValue;
    correctSum += +gridValue;
  }
  let fluencyRate =  Math.round(correctSum / (1 - body.data.time_remain / body.data.time_allowed));

  gridResult[`${subtestId}.${varName}_fluency`] = fluencyRate;
  gridResult[`${subtestId}.timestamp_${subtestCounts.timestampCount}`] = moment(body.timestamp).format('hh:mm');

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
  gpsResult[`${doc.subtestId}.timestamp_${subtestCounts.timestampCount}`] = moment(doc.data.timestamp).format('hh:mm');

  // Added because of elastic search
  gpsResult.geoip = {
    location: {
      lon: doc.data.long,
      lat: doc.data.lat
    }
  };

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
  cameraResult[`${body.subtestId}.timestamp_${subtestsCount.timestampCount}`] = moment(body.timestamp).format('hh:mm');

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

/**
 * @description – This function checks the validity of the document
 * based on certain criteria.
 *
 * @param {object} doc - a result collection.
 *
 * @returns {boolean} - result validity
 */

function validateResult(doc) {
  let endTime, i, subtest, containThreePupilsAssessment, beginAssessment, endAssessment, lastSubtest;
  let startTime = moment(doc.start_time);

  // check if result has gps.
  let hasGps = doc.hasOwnProperty('longitude') && doc.hasOwnProperty('lattitude');

  // check if assessment was completed and capture timestamps.
  let ref = doc.subtestData;
  let subtestLength = ref.length;
  lastSubtest = ref[subtestLength - 1];
  beginAssessment = moment(ref[0].data.timestamp);

  if (lastSubtest.prototype !== "complete") {
    endAssessment = moment(lastSubtest.data.timestamp);
  }

  if (lastSubtest.prototype === "complete") {
    let newSubtest = ref[subtestLength - 2];
    endAssessment = moment(newSubtest.data.timestamp);

    // if we got here it means the assessment contain 3 pupils assessment.
    containThreePupilsAssessment = true;
    endTime = moment(lastSubtest.data.end_time);
  }

  // More checks for assessment validation.
  if (hasGps && startTime && endTime) {
    // check if assessment was captured between 7am and 3:15pm
    let isCapturedTime = startTime.hours() >= 7 && endTime.hours() < 4 && endTime.minutes() <= 15;

    // check if assessment was captured during weekdays
    let isDuringWeekday = startTime.weekday > 0 && startTime.weekday < 6;

    // check if the difference between start time & end time of an assessment is more than 20mins
    let isAssessmentDurationValid = endAssessment.diff(beginAssessment, 'minutes') >= 20;

    let isValid = isCapturedTime && isDuringWeekday && isAssessmentDurationValid && containThreePupilAssessment;

    return isValid;
  }

  return false;
}

exports.generateResult = generateResult;
