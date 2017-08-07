// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');

/**
 * GET /assessment
 * return all assessments
 */
exports.all = (req, res) => {
  TMP_TANGERINEDB
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
  let assessments = [];
  let assessmentId = req.params.id;

  getAssessment(assessmentId)
    .then((item) => {
      assessments.push({ header: 'assessment_id', key: item.assessmentId + '.assessmentId' });
      assessments.push({ header: 'assessment_name', key: item.assessmentId + '.assessmentName' });
      assessments.push({ header: 'enumerator', key: item.assessmentId + '.enumerator' });
      assessments.push({ header: 'start_time', key: item.assessmentId + '.start_time' });
      assessments.push({ header: 'order_map', key: item.assessmentId + '.order_map' });

      return getSubtests(assessmentId);
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
        if (data.prototype === 'grid' && subtestCounts.gridCount < 1) {
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
      assessments.push({ header: `end_time`, key: `${assessmentId}.end_time` });

      return insertDoc(assessments, assessmentId);
    })
    .then(() => res.json(assessments))
    .catch((err) => {
      res.json(Error(err));
    });

}

// Save docs into results DB
function insertDoc(docs, ref) {
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
    TMP_TANGERINEDB
      .get(id, { include_docs: true }, (err, body) => {
        if (err) reject(err);
        resolve(body);
      });
  });
}

// Get all results collection
function getResults() {
  return new Promise((resolve, reject) => {
    TMP_TANGERINEDB
      .view('ojai', 'csvRows', { include_docs: true }, (err, body) => {
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
    TMP_TANGERINEDB
      .view('ojai', 'subtestsByAssessmentId', {
        key: id,
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
    TMP_TANGERINEDB
      .view('ojai', 'questionsByParentId', {
        key: id,
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
    TMP_TANGERINEDB
      .view('ojai', 'questionsByParentId', {
        key: subtestId,
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
  let filteredResult = _.find(resultDocs, (result) => result.assessmentId === doc.assessmentId);
  let gridData = _.filter(filteredResult.subtestData, (val) => val.prototype === 'grid');

  for (sub of gridData) {
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
