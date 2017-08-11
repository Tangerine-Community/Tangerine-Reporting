// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINE = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

/**
 * GET /assessment
 * return all assessments
 */
exports.all = (req, res) => {
  TAYARI_BACKUP
    .view('ojai', 'byCollection', {
      key: 'assessment',
      include_docs: true
    }, (err, body) => {
      if (err) res.send(err);
      res.json(body.rows)
    });
}

/**
 * GET /assessment/:id
 * return all headers and keys for a particuler assessment
 */
exports.get = (req, res) => {
  let assessmentId = req.params.id;
  createColumnHeaders(assessmentId)
    .then((result) => {
      res.json(result);
    })
    .catch((err) => res.send(Error(err)));
}

const createColumnHeaders = function(docTypeId, count) {
  let assessments = [];
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
          // TODO: Remove this comment when you confirm data difference based on tangerine version
          // if (data.prototype === 'grid' && subtestCounts.gridCount < 1) {
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

        // Save headers in Result DB
        // await saveHeaders(assessments, assessmentId);
        resolve(assessments);
      })
      .catch((err) => reject(err));
  });

}

// Save docs into results DB
const saveHeaders = function(docs, ref) {
  return new Promise((resolve, reject) => {
    RESULT_DB.insert({ column_headers: docs }, ref, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

// Get a particular assessment collection
function getAssessment(id) {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .get(id, { include_docs: true }, (err, body) => {
        if (err) reject(err);
        resolve(body);
      });
  });
}

// Get all results collection
function getResults() {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'csvRows', { limit: 100, include_docs: true }, (err, body) => {
        if (err) reject(err);
        let doc = _.map(body.rows, (data) => {
          return data.doc;
        });
        resolve(doc);
      });
  });
}

// Get all subtest collection
function getSubtests(id) {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'subtestsByAssessmentId', {
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

// Get all question collection
function getQuestions(id) {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'questionsByParentId', {
        key: id,
        limit: 100,
        include_docs: true
      }, (err, body) => {
        if (err) reject(err);
        let questionDoc = [];
        _.each(body.rows, (data) => {
          questionDoc.push(data.doc);
        });
        let orderedQuestion = _.sortBy(questionDoc, ['order']);
        resolve(orderedQuestion);
      })
  });
}

// Get all questions associated with a particular subtest
function getQuestionBySubtestId(subtestId) {
  return new Promise((resolve, reject) => {
    TAYARI_BACKUP
      .view('ojai', 'questionsByParentId', {
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

// create location prototype column data
function createLocation(doc, subtestCounts) {
  let count = subtestCounts.locationCount;
  let locationHeader = [];
  let labels = doc.locationCols;
  for (i = 0; i < labels.length; i++) {
    let locSuffix = count > 0 ? `_${count}` : '';
    locationHeader.push({
      header: `${labels[i]}${locSuffix}`,
      key: `${doc._id}.${labels[i]}${locSuffix}`
    });
  }
  locationHeader.push({
    header: `timestamp_${subtestCounts.timestampCount}`,
    key: `${doc._id}.timestamp_${subtestCounts.timestampCount}`
  });

  return locationHeader;
}

// Create datetime prototype column data
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

// Create consent prototype column data
function createConsent(doc, subtestCounts) {
  let count = subtestCounts.consentCount;
  let suffix, consentHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  consentHeader.push({ header: `consent${suffix}`, key: `${doc._id}.consent${suffix}` });
  consentHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return consentHeader;
}

// Create Id prototype column data
function createId(doc, subtestCounts) {
  let count = subtestCounts.idCount;
  let suffix, idHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  idHeader.push({ header: `id${suffix}`, key: `${doc._id}.id${suffix}` });
  idHeader.push({ header: `timestamp_${subtestCounts.timestampCount}`, key: `${doc._id}.timestamp_${subtestCounts.timestampCount}` });

  return idHeader;
}

// Create survey prototype column data
async function createSurvey(id, subtestCounts) {
  let count = subtestCounts.surveyCount;
  let surveyHeader = [];
  let suffix = count > 0 ? `_${count}` : '';
  let questions = await getQuestionBySubtestId(id);
  let sortedDoc = _.sortBy(questions, [id, 'order']);

  for (doc of sortedDoc) {
    surveyHeader.push({
      header: `${doc.name}${suffix}`,
      key: `${id}.${doc.name}${suffix}`
    });
    // TODO: Use this for meta data processing in the future
    // let i = 0;
    // for (i; i < doc.options.length; i++) {
    //   let label = doc.options[i].label.trim();
    //   label = label.toLowerCase().replace(/\s/g, '_');
    //   surveyHeader.push({
    //     header: `${doc.name}${suffix}`,
    //     key: `${id}.${doc.name}.${suffix}`
    //   });
    // }
  }
  surveyHeader.push({
    header: `timestamp_${subtestCounts.timestampCount}`,
    key: `${id}.timestamp_${subtestCounts.timestampCount}`
  });

  return surveyHeader;
}

// Create grid prototype column data
async function createGrid(doc, subtestCounts) {
  let count = subtestCounts.gridCount;
  let gridHeader = [];
  let suffix = count > 0 ? `_${count}` : '';
  let resultDocs = await getResults();
  let docId = doc.assessmentId || doc.curriculumId;

  let gridData = _.filter(resultDocs, (result) => result.assessmentId === docId);

  // TODO: cater for one doc
  // let gridData = [];
  // _.each(filteredResult, (item) => {
  //   _.filter(item.subtestData, (val) => {
  //     if(val.prototype === 'grid') {
  //       gridData.push(val);
  //     }
  //   });
  // });

  for (items of gridData) {
    for (sub of items.subtestData) {
      let i, items = sub.data.items;
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
  }

  return { gridHeader, timestampCount: subtestCounts.timestampCount };
}

// Create GPS prototype column data
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

// Create camera prototype column data
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
