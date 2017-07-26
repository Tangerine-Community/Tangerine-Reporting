// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');


exports.all = (req, res) => {
  let assessments = [];
  getAssessments()
    .then((data) => {;
      _.each(data, (item) => {
        assessments.push({ key: item.doc.assessmentId + '_id', header: 'Assessment ID' });
        assessments.push({ key: item.doc.assessmentId + '_name', header: 'Assessment Name' });
      });
      return getSubtests();
    })
    .then((subtestData) => {
      let subtestCount = {
        locationCount: 0,
        datetimeCount: 0,
        idCount: 0,
        consentCount: 0,
        gpsCount: 0,
        surveyCount: 0,
        cameraCount: 0
      };
      _.each(subtestData, (data) => {
        if (data.prototype === 'location') {
          let location = createLocation(data, subtestCount.locationCount);
          assessments = assessments.concat(location);
          subtestCount.locationCount++;
          return ;
        }
        if (data.prototype === 'datetime') {
          let datetime = createDatetime(data, subtestCount.datetimeCount);
          assessments = assessments.concat(datetime);
          subtestCount.datetimeCount++;
          return ;
        }
        if (data.prototype === 'consent') {
          let consent = createConsent(data, subtestCount.consentCount);
          assessments = assessments.concat(consent);
          subtestCount.consentCount++;
          return ;
        }
        if (data.prototype === 'id') {
          let id = createId(data, subtestCount.idCount);
          assessments = assessments.concat(id);
          subtestCount.idCount++;
          return ;
        }
        if (data.prototype === 'survey') {
          let survey = createSurvey(data, subtestCount.surveyCount);
          assessments = assessments.concat(survey);
          subtestCount.surveyCount++;
          return ;
        }
        if (data.prototype === 'gps') {
          let gps = createGps(data, subtestCount.gpsCount);
          assessments = assessments.concat(gps);
          subtestCount.gpsCount++;
          return ;
        }
        if (data.prototype === 'camera') {
          let camera = createCamera(data, subtestCount.cameraCount);
          assessments = assessments.concat(camera);
          subtestCount.cameraCount++;
          return ;
        }
      });

      res.json(ans);
    })
    .catch((err) => {
      res.json(Error(err));
    });
}

// Get all assessment collection
function getAssessments() {
  return new Promise((resolve, reject) => {
    TMP_TANGERINEDB
      .view('ojai', 'byCollection', {
        key: 'assessment',
        include_docs: true
      }, (err, body) => {
        if (err) reject(err);
        resolve(body.rows)
      });
  });
}

// Get all subtest collection
function getSubtests() {
  return new Promise((resolve, reject) => {
    TMP_TANGERINEDB
      .view('ojai', 'subtestsByAssessmentId', {
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

// create location prototype column data
function createLocation(doc, count) {
  let locationHeader = [];
  let labels = doc.locationCols;
  for (i = 0; i < labels.length; i++) {
    let locSuffix = count > 0 ? `_${count}` : '';
    locationHeader.push({
      header: `${labels[i]}${locSuffix}`,
      key: `${doc._id}_${labels[i]}${locSuffix}`
    });
  }

  return locationHeader;
}

// Create datetime prototype column data
function createDatetime(doc, count) {
  let suffix, datetimeHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  datetimeHeader.push({ header: `year${suffix}`, key: `${doc._id}_year${suffix}` });
  datetimeHeader.push({ header: `month${suffix}`, key: `${doc._id}_month${suffix}` });
  datetimeHeader.push({ header: `day${suffix}`, key: `${doc._id}_day${suffix}` });
  datetimeHeader.push({ header: `assess_time${suffix}`, key: `${doc._id}_assess_time${suffix}` });

  return datetimeHeader;
}

// Create consent prototype column data
function createConsent(doc, count) {
  let suffix, consentHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  consentHeader.push({ header: `consent${suffix}`, key: `${doc._id}_consent${suffix}` });

  return consentHeader;
}

// Create Id prototype column data
function createId(doc, count) {
  let suffix, idHeader = [];

  suffix = count > 0 ? `_${count}` : '';
  idHeader.push({ header: `id${suffix}`, key: `${doc._id}_id${suffix}` });

  return idHeader;
}

// Create survey prototype column data
function createSurvey(doc, count) {
  let suffix, surveyHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  for (i = 0; i < doc.items.length; i++) {
    surveyHeader.push({
      header: `surveyVar-${i}${suffix}`,
      key: `${doc._id}_surveyVar-${i}${suffix}`
    });
  }
  return surveyHeader;
}

// Create GPS prototype column data
function createGps(doc, count) {
  let suffix, gpsHeader = [];
  suffix = count > 0 ? `_${count}` : '';

  gpsHeader.push({ header: `latitude${suffix}`, key: `${doc._id}_latitude${suffix}` });
  gpsHeader.push({ header: `longitude${suffix}`, key: `${doc._id}_longitude${suffix}` });
  gpsHeader.push({ header: `accuracy${suffix}`, key: `${doc._id}_accuracy${suffix}` });
  gpsHeader.push({ header: `altitude${suffix}`, key: `${doc._id}_altitude${suffix}` });
  gpsHeader.push({ header: `altitudeAccuracy${suffix}`, key: `${doc._id}_altitudeAccuracy${suffix}` });
  gpsHeader.push({ header: `heading${suffix}`, key: `${doc._id}_heading${suffix}` });
  gpsHeader.push({ header: `speed${suffix}`, key: `${doc._id}_speed${suffix}` });
  gpsHeader.push({ header: `timestamp${suffix}`, key: `${doc._id}_timestamp${suffix}` });

  return gpsHeader;
}

// Create camera prototype column data
function createCamera(data) {
  let suffix, cameraheader = [];
  suffix = count > 0 ? `_${count}` : '';

  cameraheader.push({ header: `varName_photo_captured${suffix}`, key: `${doc._id}_varName_photo_captured${suffix}` });
  cameraheader.push({ header: `varName_photo_url${suffix}`, key: `${doc._id}_varName_photo_url${suffix}` });

  return cameraheader;
}
