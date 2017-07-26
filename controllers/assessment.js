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
      let locationPrototype = createLocation(subtestData);
      let datetimePrototype = createDatetime(subtestData);
      let consentPrototype = createConsent(subtestData);
      let idPrototype = createId(subtestData);
      let surveyPrototype = createSurvey(subtestData);
      let gpsPrototype = createGps(subtestData);
      let cameraPrototype = create(subtestData);

      let result =  assessments.concat(locationPrototype, datetimePrototype, consentPrototype);
      result = result.concat(surveyPrototype, gpsPrototype, cameraPrototype);

      res.json(result);
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
function createLocation(locData) {
  let locationHeader = [];
  let locationCount = 0;

  _.forEach(locData, (subData) => {
    if (subData.prototype === 'location') {
      let labels = subData.locationCols;
      for (i = 0; i < labels.length; i++) {
        let locSuffix = locationCount > 0 ? `_${locationCount}` : '';
        locationHeader.push({
          header: `${labels[i]}${locSuffix}`,
          key: `${subData._id}_${labels[i]}${locSuffix}`
        });
      }
      locationCount++;
      return ;
    }
  });

  return locationHeader;
}

// Create datetime prototype column data
function createDatetime(dateData) {
  let suffix, datetimeCount = 0, datetimeHeader = [];
  _.forEach(dateData, (doc) => {
    if (doc.prototype === 'datetime') {
      suffix = datetimeCount > 0 ? `_${datetimeCount}` : '';
      datetimeHeader.push({ header: `year${suffix}`, key: `${doc._id}_year${suffix}` });
      datetimeHeader.push({ header: `month${suffix}`, key: `${doc._id}_month${suffix}` });
      datetimeHeader.push({ header: `day${suffix}`, key: `${doc._id}_day${suffix}` });
      datetimeHeader.push({ header: `assess_time${suffix}`, key: `${doc._id}_assess_time${suffix}` });
      datetimeCount++;
      return ;
    }
  });
  return datetimeHeader;
}

// Create consent prototype column data
function createConsent(data) {
  let suffix, count = 0, consentHeader = [];
  _.each(data, (doc) => {
    if (doc.prototype === 'consent') {
      suffix = count > 0 ? `_${count}` : '';
      consentHeader.push({ header: `consent${suffix}`, key: `${doc._id}_consent${suffix}` });
      count++;
      return ;
    }
  });
  return consentHeader;
}

// Create Id prototype column data
function createId(data) {
  let suffix, count = 0, idHeader = [];
  _.each(data, (doc) => {
    if (doc.prototype === 'id') {
      suffix = count > 0 ? `_${count}` : '';
      idHeader.push({ header: `id${suffix}`, key: `${doc._id}_id${suffix}` });
      count++;
      return ;
    }
  });
  return idHeader;
}

// Create survey prototype column data
function createSurvey(data) {
  let suffix, count = 0, surveyHeader = [];
  _.each(data, (doc) => {
    if (doc.prototype === 'survey') {
      suffix = count > 0 ? `_${count}` : '';
      for (i = 0; i < doc.items.length; i++) {
        surveyHeader.push({
          header: `surveyVar-${i}${suffix}`,
          key: `${doc._id}_surveyVar-${i}${suffix}`
        });
      }
      count++;
      return ;
    }
  });
  return surveyHeader;
}

// Create GPS prototype column data
function createGps(data) {
  let suffix, count = 0, gpsHeader = [];
  _.forEach(data, (doc) => {
    if (doc.prototype === 'gps') {
      suffix = count > 0 ? `_${count}` : '';
      gpsHeader.push({ header: `latitude${suffix}`, key: `${doc._id}_latitude${suffix}` });
      gpsHeader.push({ header: `longitude${suffix}`, key: `${doc._id}_longitude${suffix}` });
      gpsHeader.push({ header: `accuracy${suffix}`, key: `${doc._id}_accuracy${suffix}` });
      gpsHeader.push({ header: `altitude${suffix}`, key: `${doc._id}_altitude${suffix}` });
      gpsHeader.push({ header: `altitudeAccuracy${suffix}`, key: `${doc._id}_altitudeAccuracy${suffix}` });
      gpsHeader.push({ header: `heading${suffix}`, key: `${doc._id}_heading${suffix}` });
      gpsHeader.push({ header: `speed${suffix}`, key: `${doc._id}_speed${suffix}` });
      gpsHeader.push({ header: `timestamp${suffix}`, key: `${doc._id}_timestamp${suffix}` });
      count++;
      return ;
    }
  });
  return gpsHeader;
}

// Create camera prototype column data
function createCamera(data) {
  let suffix, count = 0, cameraheader = [];
  _.forEach(data, (doc) => {
    if (doc.prototype === 'camera') {
      suffix = count > 0 ? `_${count}` : '';
      cameraheader.push({ header: `varName_photo_captured${suffix}`, key: `${doc._id}_varName_photo_captured${suffix}` });
      cameraheader.push({ header: `varName_photo_url${suffix}`, key: `${doc._id}_varName_photo_url${suffix}` });
      count++;
      return ;
    }
  });
  return cameraheader;
}
