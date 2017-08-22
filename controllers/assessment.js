/**
 * This file creates headers or metadata from an assessment.
 * These headers or metadata will serve as column headers for CSV generation.
 * It also exposes the createColumnHeaders and saveHeaders modules.
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');
const nano = require('nano');

/**
 * Declare database variables.
 */
let RESULT_DB, BASE_DB;

/**
 * GET /assessment
 * return all assessments.
 */
exports.all = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  BASE_DB.view('ojai', 'byCollection', {
    key: 'assessment',
    include_docs: true
  }, (err, body) => {
    if (err) res.send(err);
    res.json(body.rows);
  });
}

/**
 * GET /assessment/:id
 * return all headers and keys for a assessment.
*/
exports.get = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  RESULT_DB = nano(req.body.result_db);
  let assessmentId = req.params.id;

  createColumnHeaders(assessmentId)
    .then((result) => {
      return saveHeaders(result, assessmentId, RESULT_DB);
    })
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.send(Error(err)));
}

/**
 * This function processes the headers for an assessment.
 * @param {string, number, string} [docTypeId, count, dbUrl] assessmentId, count and database url.
 * @returns {Object} processed headers for csv.
 */
const createColumnHeaders = function(docTypeId, count = 0, dbUrl) {
  let assessments = [];
  BASE_DB = BASE_DB || nano(dbUrl);

  return new Promise((resolve, reject) => {
    getAssessment(docTypeId)
      .then((item) => {
        if (item.assessmentId) {
          let assessmentSuffix = count > 0 ? `_${count}` : '';
          assessments.push({ header: `assessment_id${assessmentSuffix}`, key: `${item.assessmentId}.assessmentId${assessmentSuffix}` });
          assessments.push({ header: `assessment_name${assessmentSuffix}`, key: `${item.assessmentId}.assessmentName${assessmentSuffix}` });
          assessments.push({ header: `enumerator${assessmentSuffix}`, key: `${item.assessmentId}.enumerator${assessmentSuffix}` });
          assessments.push({ header: `start_time${assessmentSuffix}`, key: `${item.assessmentId}.start_time${assessmentSuffix}` });
          assessments.push({ header: `order_map${assessmentSuffix}`, key: `${item.assessmentId}.order_map${assessmentSuffix}` });
        }
        return getSubtests(docTypeId);
      })
      .then(async(subtestData) => {
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

        for (data of subtestData) {
          if (data.prototype === 'location') {
            let location = createLocation(data, subtestCounts);
            assessments = assessments.concat(location);
            subtestCounts.locationCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'datetime') {
            let datetime = createDatetime(data, subtestCounts);
            assessments = assessments.concat(datetime);
            subtestCounts.datetimeCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'consent') {
            let consent = createConsent(data, subtestCounts);
            assessments = assessments.concat(consent);
            subtestCounts.consentCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'id') {
            let id = createId(data, subtestCounts);
            assessments = assessments.concat(id);
            subtestCounts.idCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'survey') {
            let surveys = await createSurvey(data._id, subtestCounts);
            assessments = assessments.concat(surveys);
            subtestCounts.surveyCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'grid') {
            let grid = await createGrid(data, subtestCounts);
            assessments = assessments.concat(grid.gridHeader);
            subtestCounts.gridCount++;
            subtestCounts.timestampCount = grid.timestampCount;
          }
          if (data.prototype === 'gps') {
            let gps = createGps(data, subtestCounts);
            assessments = assessments.concat(gps);
            subtestCounts.gpsCount++;
            subtestCounts.timestampCount++;
          }
          if (data.prototype === 'camera') {
            let camera = createCamera(data, subtestCounts);
            assessments = assessments.concat(camera);
            subtestCounts.cameraCount++;
            subtestCounts.timestampCount++;
          }
        }
        let assessmentSuffix = count > 0 ? `_${count}` : '';
        assessments.push({ header: `end_time${assessmentSuffix}`, key: `${docTypeId}.end_time${assessmentSuffix}` });

        resolve(assessments);
      })
      .catch((err) => reject(err));
  });

}

/**
 * This function inserts headers in the database.
 * @param {string, string, string} [docs, ref, resultDB] document, key and database.
 * @returns {Object} saved document.
 */
const saveHeaders = function(docs, ref, resultDB) {
  return new Promise((resolve, reject) => {
    resultDB.insert({ column_headers: docs }, ref, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

/**
 * This function retrieves an assessment document.
 * @param {string} id id of document.
 * @returns {Object} assessment documents.
 */
function getAssessment(id) {
  return new Promise((resolve, reject) => {
    BASE_DB.get(id, { include_docs: true }, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

/**
 * This function retrieves all result collection.
 * @returns {Array} result documents.
 */
function getResults() {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'csvRows', { limit: 100, include_docs: true }, (err, body) => {
      if (err) reject(err);
      let doc = _.map(body.rows, (data) => {
        return data.doc;
      });
      resolve(doc);
    });
  });
}

/**
 * This function retrieves all subtest linked to an assessment.
 * @param {string} id id of assessment document.
 * @returns {Array} subtest documents.
 */
function getSubtests(id) {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'subtestsByAssessmentId', {
      key: id,
      limit: 100,
      include_docs: true
    }, (err, body) => {
      if (err) reject(err);
      let subtestDoc = [];
      _.each(body.rows, (data) => {
        subtestDoc.push(data.doc);
      });
      let orderedSubtests = _.sortBy(subtestDoc, ['assessmentId', 'order']);
      resolve(orderedSubtests);
    })
  });
}

/**
 * This function retrieves all questions linked to a subtest document.
 * @param {string} subtestId id of subtest document.
 * @returns {Array} question documents.
 */
function getQuestionBySubtestId(subtestId) {
  return new Promise((resolve, reject) => {
    BASE_DB.view('ojai', 'questionsByParentId', {
      key: subtestId,
      limit: 100,
      include_docs: true
    }, (err, body) => {
      if (err) reject(err);
      let doc = _.map(body.rows, (data) => {
        return data.doc;
      });
      resolve(doc);
    });
  });
}

/**
 * This function creates headers for location prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated location headers.
 */
function createLocation(doc, subtestCounts) {
  let count = subtestCounts.locationCount;
  let locationHeader = [];
  let labels = doc.levels;

  for (i = 0; i < labels.length; i++) {
    let locSuffix = count > 0 ? `_${count}` : '';
    locationHeader.push({
      header: `${labels[i]}${locSuffix}`,
      key: `${doc._id}.${labels[i].toLowerCase()}${locSuffix}`
    });
  }
  locationHeader.push({
    header: `timestamp_${subtestCounts.timestampCount}`,
    key: `${doc._id}.timestamp_${subtestCounts.timestampCount}`
  });

  return locationHeader;
}

/**
 * This function creates headers for datetime prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated datetime headers.
 */
function createDatetime(doc, subtestCounts) {
  let count = subtestCounts.datetimeCount;
  let suffix, datetimeHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  datetimeHeader.push({ header: `year${suffix}`, key: `${doc._id}.year${suffix}` });
  datetimeHeader.push({ header: `month${suffix}`, key: `${doc._id}.month${suffix}` });
  datetimeHeader.push({ header: `day${suffix}`, key: `${doc._id}.day${suffix}` });
  datetimeHeader.push({ header: `assess_time${suffix}`, key: `${doc._id}.assess_time${suffix}` });
  datetimeHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return datetimeHeader;
}

/**
 * This function creates headers for consent prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated consent headers.
 */
function createConsent(doc, subtestCounts) {
  let count = subtestCounts.consentCount;
  let suffix, consentHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  consentHeader.push({ header: `consent${suffix}`, key: `${doc._id}.consent${suffix}` });
  consentHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return consentHeader;
}

/**
 * This function creates headers for id prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated id headers.
 */
function createId(doc, subtestCounts) {
  let count = subtestCounts.idCount;
  let suffix, idHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  idHeader.push({ header: `id${suffix}`, key: `${doc._id}.id${suffix}` });
  idHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return idHeader;
}

/**
 * This function creates headers for survey prototypes.
 * @param {Object, Object} [id, subtestCounts] document to be processed and count.
 * @returns {Array} generated survey headers.
 */
async function createSurvey(id, subtestCounts) {
  let count = subtestCounts.surveyCount;
  let surveyHeader = [];
  let suffix = count > 0 ? `_${count}` : '';
  let questions = await getQuestionBySubtestId(id);
  let sortedDoc = _.sortBy(questions, [id, 'order']);

  for (doc of sortedDoc) {
    let optionsLen = doc.options.length;
    if (optionsLen <= 2) {
      surveyHeader.push({
        header: `${doc.name}${suffix}`,
        key: `${id}.${doc.name}${suffix}`
      });
    }
    else {
      let i = 1;
      for (i; i <= optionsLen; i++) {
        surveyHeader.push({
          header: `${doc.name}_${i}${suffix}`,
          key: `${id}.${doc.name}.${i}${suffix}`
        });
      }
    }
  }
  surveyHeader.push({
    header: `timestamp_${subtestCounts.timestampCount}`,
    key: `${id}.timestamp_${subtestCounts.timestampCount}`
  });

  return surveyHeader;
}

/**
 * This function creates headers for grid prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated grid headers.
 */
async function createGrid(doc, subtestCounts) {
  let count = subtestCounts.gridCount;
  let gridHeader = [];
  let gridData = [];
  let suffix = count > 0 ? `_${count}` : '';
  let resultDocs = await getResults();
  let docId = doc.assessmentId || doc.curriculumId;

  let filteredResult = _.filter(resultDocs, (result) => result.assessmentId === docId);

  _.each(filteredResult, (item) => {
    _.filter(item.subtestData, (value) => {
      if(value.prototype === 'grid') {
        gridData.push(value);
      }
    });
  });

  for (sub of gridData) {
    let i; items = sub.data.items;
    let variableName = sub.data.variable_name || sub.name.toLowerCase().replace(/\s/g, '_');

    gridHeader.push({
      header: `${variableName}_auto_stop${suffix}`,
      key: `${sub.subtestId}.${variableName}_auto_stop${suffix}`
    });
    gridHeader.push({
      header: `${variableName}_time_remain${suffix}`,
      key: `${sub.subtestId}.${variableName}_time_remain${suffix}`
    });
    gridHeader.push({
      header: `${variableName}_capture_item_at_time${suffix}`,
      key: `${sub.subtestId}.${variableName}_capture_item_at_time${suffix}`
    });
    gridHeader.push({
      header: `${variableName}_attempted${suffix}`,
      key: `${sub.subtestId}.${variableName}_attempted${suffix}`
    });
    gridHeader.push({
      header: `${variableName}_time_intermediate_captured${suffix}`,
      key: `${sub.subtestId}.${variableName}_time_intermediate_captured${suffix}`
    });
    gridHeader.push({
      header: `${variableName}_time_allowed${suffix}`,
      key: `${sub.subtestId}.${variableName}_time_allowed${suffix}`
    });

    for (i = 0; i < items.length; i++) {
      let label = items[i].itemLabel;
      gridHeader.push({
        header: `${variableName}_${label}${suffix}`,
        key: `${sub.subtestId}.${variableName}_${label}${suffix}`
      });
    }
    gridHeader.push({
      header: `timestamp_${subtestCounts.timestampCount}`,
      key: `${sub.subtestId}.timestamp_${subtestCounts.timestampCount}`
    });
    subtestCounts.timestampCount++;
  }

  return { gridHeader, timestampCount: subtestCounts.timestampCount };
}

/**
 * This function creates headers for gps prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated gps headers.
 */
function createGps(doc, subtestCounts) {
  let count = subtestCounts.gpsCount;
  let gpsHeader = [];
  let suffix = count > 0 ? `_${count}` : '';

  gpsHeader.push({ header: `latitude${suffix}`, key: `${doc._id}.latitude${suffix}` });
  gpsHeader.push({ header: `longitude${suffix}`, key: `${doc._id}.longitude${suffix}` });
  gpsHeader.push({ header: `accuracy${suffix}`, key: `${doc._id}.accuracy${suffix}` });
  gpsHeader.push({ header: `altitude${suffix}`, key: `${doc._id}.altitude${suffix}` });
  gpsHeader.push({ header: `altitudeAccuracy${suffix}`, key: `${doc._id}.altitudeAccuracy${suffix}` });
  gpsHeader.push({ header: `heading${suffix}`, key: `${doc._id}.heading${suffix}` });
  gpsHeader.push({ header: `speed${suffix}`, key: `${doc._id}.speed${suffix}` });
  gpsHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return gpsHeader;
}

/**
 * This function creates headers for camera prototypes.
 * @param {Object, Object} [doc, subtestCounts] document to be processed and count.
 * @returns {Array} generated camera headers.
 */
function createCamera(doc, subtestCounts) {
  let count = subtestCounts.cameraCount;
  let cameraheader = [];
  let varName = doc.variableName;
  let suffix = count > 0 ? `_${count}` : '';

  cameraheader.push({ header: `${varName}_photo_captured${suffix}`, key: `${doc.subtestId}.${varName}_photo_captured${suffix}` });
  cameraheader.push({ header: `${varName}_photo_url${suffix}`, key: `${doc.subtestId}.${varName}_photo_url${suffix}` });
  cameraheader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc.subtestId}.timestamp_${subtestCounts.timestampCount}` });

  return cameraheader;
}

exports.createColumnHeaders = createColumnHeaders;

exports.saveHeaders = saveHeaders;
