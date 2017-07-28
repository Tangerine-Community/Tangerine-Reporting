// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');


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

exports.get = (req, res) => {
  let assessments = [];
  let assessmentId = req.params.id;
  let subtests;

  getAssessments(assessmentId)
    .then((item) => {;
      assessments.push({ key: item.assessmentId + '.id', header: 'Assessment ID' });
      assessments.push({ key: item.assessmentId + '.name', header: 'Assessment Name' });
      return getSubtests(assessmentId);
    })
    .then((subtestData) => {
      subtest = subtestData;
      let subtestCounts = {
        locationCount: 0,
        datetimeCount: 0,
        idCount: 0,
        consentCount: 0,
        gpsCount: 0,
        cameraCount: 0
      };
      _.each(subtestData, (data) => {
        if (data.prototype === 'location') {
          let location = createLocation(data, subtestCounts.locationCount);
          assessments = assessments.concat(location);
          subtestCounts.locationCount++;
          return;
        }
        if (data.prototype === 'datetime') {
          let datetime = createDatetime(data, subtestCounts.datetimeCount);
          assessments = assessments.concat(datetime);
          subtestCounts.datetimeCount++;
          return;
        }
        if (data.prototype === 'consent') {
          let consent = createConsent(data, subtestCounts.consentCount);
          assessments = assessments.concat(consent);
          subtestCounts.consentCount++;
          return;
        }
        if (data.prototype === 'id') {
          let id = createId(data, subtestCounts.idCount);
          assessments = assessments.concat(id);
          subtestCounts.idCount++;
          return;
        }
        if (data.prototype === 'gps') {
          let gps = createGps(data, subtestCounts.gpsCount);
          assessments = assessments.concat(gps);
          subtestCounts.gpsCount++;
          return;
        }
        if (data.prototype === 'camera') {
          let camera = createCamera(data, subtestCounts.cameraCount);
          assessments = assessments.concat(camera);
          subtestCounts.cameraCount++;
          return;
        }
      });
      return getQuestions(assessmentId);
    })
    .then(async (questionData) => {
      let subtestQuestion = [];
      for (let data of questionData) {
        if (data.subtestId) {
          let items = await getQuestionBySubtestId(data.subtestId);
          let sortedDoc = _.sortBy(items, 'order');
          let suffix, count = 0;

          _.each(sortedDoc, (doc) => {
            suffix = count > 0 ? `_${count}` : '';
            for (let i = 0; i < doc.options.length; i++) {
              let label = doc.options[i].label.trim();
              label = label.toLowerCase().replace(/\s/g, '_');
              subtestQuestion.push({
                header: `${data.name}_${label}${suffix}`,
                key: `${data.subtestId}.${data.name}.${label}${suffix}`
              });
            }
            count++;
          });
        }
      }
      let allDoc = assessments.concat(subtestQuestion);

      res.json(allDoc);
    })
    .catch((err) => {
      res.json(Error(err));
    });

}

// Get all assessment collection
function getAssessments(id) {
  return new Promise((resolve, reject) => {
    TMP_TANGERINEDB
      .get(id, { include_docs: true }, (err, body) => {
        if (err) reject(err);
        resolve(body);
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
function createLocation(doc, count) {
  let locationHeader = [];
  let labels = doc.locationCols;
  for (i = 0; i < labels.length; i++) {
    let locSuffix = count > 0 ? `_${count}` : '';
    locationHeader.push({
      header: `${labels[i]}${locSuffix}`,
      key: `${doc._id}.${labels[i]}${locSuffix}`
    });
  }

  return locationHeader;
}

// Create datetime prototype column data
function createDatetime(doc, count) {
  let suffix, datetimeHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  datetimeHeader.push({ header: `year${suffix}`, key: `${doc._id}.year${suffix}` });
  datetimeHeader.push({ header: `month${suffix}`, key: `${doc._id}.month${suffix}` });
  datetimeHeader.push({ header: `day${suffix}`, key: `${doc._id}.day${suffix}` });
  datetimeHeader.push({ header: `assess_time${suffix}`, key: `${doc._id}.assess_time${suffix}` });

  return datetimeHeader;
}

// Create consent prototype column data
function createConsent(doc, count) {
  let suffix, consentHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  consentHeader.push({ header: `consent${suffix}`, key: `${doc._id}.consent${suffix}` });

  return consentHeader;
}

// Create Id prototype column data
function createId(doc, count) {
  let suffix, idHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  idHeader.push({ header: `id${suffix}`, key: `${doc._id}.id${suffix}` });

  return idHeader;
}

// Create survey prototype column data
function createSurvey(doc, count) {
  let suffix, surveyHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  for (i = 0; i < doc.items.length; i++) {
    surveyHeader.push({
      header: `surveyVar-${i}${suffix}`,
      key: `${doc._id}.surveyVar-${i}${suffix}`
    });
  }
  return surveyHeader;
}

// Create GPS prototype column data
function createGps(doc, count) {
  let suffix, gpsHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  gpsHeader.push({ header: `latitude${suffix}`, key: `${doc._id}.latitude${suffix}` });
  gpsHeader.push({ header: `longitude${suffix}`, key: `${doc._id}.longitude${suffix}` });
  gpsHeader.push({ header: `accuracy${suffix}`, key: `${doc._id}.accuracy${suffix}` });
  gpsHeader.push({ header: `altitude${suffix}`, key: `${doc._id}.altitude${suffix}` });
  gpsHeader.push({ header: `altitudeAccuracy${suffix}`, key: `${doc._id}.altitudeAccuracy${suffix}` });
  gpsHeader.push({ header: `heading${suffix}`, key: `${doc._id}.heading${suffix}` });
  gpsHeader.push({ header: `speed${suffix}`, key: `${doc._id}.speed${suffix}` });
  gpsHeader.push({ header: `timestamp${suffix}`, key: `${doc._id}.timestamp${suffix}` });

  return gpsHeader;
}

// Create camera prototype column data
function createCamera(data) {
  let suffix, cameraheader = [];
  suffix = count > 0 ? `_${count}` : '';

  cameraheader.push({ header: `varName_photo_captured${suffix}`, key: `${doc._id}.varName_photo_captured${suffix}` });
  cameraheader.push({ header: `varName_photo_url${suffix}`, key: `${doc._id}.varName_photo_url${suffix}` });

  return cameraheader;
}
