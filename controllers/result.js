//  Module dependencies
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');

/**
 * GET /result
 * return all results collection
 */
exports.all = (req, res) => {
  TMP_TANGERINEDB
    .view('ojai', 'csvRows', { include_docs: true }, (err, body) => {
      if (err) res.json(err);
      let doc = _.map(body.rows, (data) => {
        return data.doc;
      });
      res.json(doc.slice(0,10));
    });
}

/**
 * GET /result/:id
 * return result for a particular assessment id
 */
exports.get = (req, res) => {
  let result = { assessmentId: req.params.id };

  getResultById(result.assessmentId)
    .then((data) => {
      let subtestCounts = {
        locationCount: 0,
        datetimeCount: 0,
        idCount: 0,
        consentCount: 0,
        gpsCount: 0,
        cameraCount: 0,
        surveyCount: 0,
        gridCount: 0
      };

      for (doc of data.subtestData) {
        if (doc.prototype === 'location') {
          let location = processLocationResult(doc, subtestCounts.locationCount);
          result = _.assignIn(result, location);
          subtestCounts.locationCount++;
        }
        if (doc.prototype === 'datetime') {
          let datetime = processDatetimeResult(doc, subtestCounts.datetimeCount);
          result = _.assignIn(result, datetime);
          subtestCounts.datetimeCount++;
        }
        if (doc.prototype === 'consent') {
          let consent = processConsentResult(doc, subtestCounts.consentCount);
          result = _.assignIn(result, consent);
          subtestCounts.consentCount++;
        }
        if (doc.prototype === 'id') {
          let id = processIDResult(doc, subtestCounts.idCount);
          result = _.assignIn(result, id);
          subtestCounts.idCount++;
        }
        if (doc.prototype === 'survey') {
          let survey = processSurveyResult(doc, subtestCounts.surveyCount);
          result = _.assignIn(result, survey);
          subtestCounts.surveyCount++;
        }
        if (doc.prototype === 'grid') {
          let grid = processGridResult(doc, subtestCounts.gridCount);
          result = _.assignIn(result, grid);
          subtestCounts.gridCount++;
        }
        if (doc.prototype === 'gps') {
          let gps = processGpsResult(doc, subtestCounts.gpsCount);
          result = _.assignIn(result, gps);
          subtestCounts.gpsCount++;
        }
        if (doc.prototype === 'camera') {
          let camera = processCamera(doc, subtestCounts.cameraCount);
          result = _.assignIn(result, camera);
          subtestCounts.cameraCount++;
        }
      }
      res.json(result);
    })
    .catch((err) => {
      res.json(Error(err));
    });
}

// Get result collection by assessment id
function getResultById(docId) {
  return new Promise((resolve, reject) => {
    TMP_TANGERINEDB
      .view('ojai', 'csvRows', { include_docs: true }, (err, body) => {
        if (err) reject(err);
        let doc = _.map(body.rows, (data) => {
          return data.doc;
        });
        resultDoc = _.find(doc, (data) => data.assessmentId === docId);
        resolve(resultDoc);
      });
  })

}

// Generate location prototype result
function processLocationResult(body, count) {
  let i, locationResult = {};
  let locSuffix = count > 0 ? `_${count}` : '';
  let labels = body.data.labels;
  let location = body.data.location;
  let subtestId = body.subtestId;

  for (i = 0; i < labels.length; i++) {
    let key = `${subtestId}.${labels[i]}${locSuffix}`
    locationResult[key] = location[i];
  }
  return locationResult;
}

// Generate datetime prototype result
function processDatetimeResult(doc, count) {
  let suffix = count > 0 ? `_${count}` : '';
  datetimeResult = {
    [`${doc.subtestId}.year${suffix}`]: doc.data.year,
    [`${doc.subtestId}.month${suffix}`]: doc.data.month,
    [`${doc.subtestId}.day${suffix}`]: doc.data.day,
    [`${doc.subtestId}.assess_time${suffix}`]: doc.data.time
  }
  return datetimeResult;
}

// Generate result for consent prototype
function processConsentResult(body, count) {
  let suffix = count > 0 ? `_${count}` : '';
  consentResult = {
    [`${body.subtestId}.consent${suffix}`]: body.data.consent
  };
  return consentResult;
}

// Generate result for ID prototype
function processIDResult(body, count) {
  let suffix = count > 0 ? `_${count}` : '';
  idResult = {
    [`${body.subtestId}.id${suffix}`]: body.data.participant_id
  };
  return idResult;
}

// Generate result for survey prototype
function processSurveyResult(body, count) {
  let surveyResult = {};
  for (doc in body.data) {
    surveyResult[`${body.subtestId}.${doc}`] = body.data[doc];
  }
  return surveyResult;
}

// Generate result for grid prototype
function processGridResult(body, count) {
  let varName = body.data.variable_name || body.name.toLowerCase().replace(/\s/g, '_');
  let subtestId = body.subtestId;
  let gridResult = {};
  let suffix = count > 0 ? `_${count}` : '';

  gridResult[`${subtestId}.${varName}_auto_stop${suffix}`] = body.data.auto_stop;
  gridResult[`${subtestId}.${varName}_time_remain${suffix}`] = body.data.time_remain;
  gridResult[`${subtestId}.${varName}_item_at_time${suffix}`] = body.data.item_at_time;
  gridResult[`${subtestId}.${varName}_attempted${suffix}`] = body.data.attempted;
  gridResult[`${subtestId}.${varName}_time_intermediate_captured${suffix}`] = body.data.time_intermediate_captured$;
  gridResult[`${subtestId}.${varName}_time_allowed${suffix}`] = body.data.time_allowed;

  for (doc of body.data.items) {
    gridResult[`${subtestId}.${varName}_${doc.itemLabel}`] = doc.itemResult;
  }
  return gridResult;
}


// Generate result for GPS prototype
function processGpsResult(doc, count) {
  let gpsResult = {};
  let suffix = count > 0 ? `_${count}` : '';

  gpsResult[`${doc.subtestId}.latitude${suffix}`] = doc.data.latitude;
  gpsResult[`${doc.subtestId}.longitude${suffix}`] = doc.data.longitude;
  gpsResult[`${doc.subtestId}.accuracy${suffix}`] = doc.data.accuracy;
  gpsResult[`${doc.subtestId}.altitude${suffix}`] = doc.data.altitude;
  gpsResult[`${doc.subtestId}.altitudeAccuracy${suffix}`] = doc.data.altitudeAccuracy;
  gpsResult[`${doc.subtestId}.heading${suffix}`] = doc.data.heading;
  gpsResult[`${doc.subtestId}.speed${suffix}`] = doc.data.speed;
  gpsResult[`${doc.subtestId}.timestamp${suffix}`] = doc.data.timestamp;

  return gpsResult;
}

// Generate result for Camera prototype
function processCamera(body, count) {
  let cameraResult = {};
  let varName = body.data.variableName;
  let suffix = count > 0 ? `_${count}` : '';

  cameraResult[`${body.subtestId}.${varName}_photo_captured${suffix}`] = body.data.imageBase64;
  cameraResult[`${body.subtestId}.${varName}_photo_url${suffix}`] = body.data.imageBase64;

  return cameraResult;
}


/*
 * Ignore these functions below
 */

function generateCSV(colSettings, data) {
  let workbook = new Excel.Workbook();
  workbook.creator = 'Brockman';
  workbook.lastModifiedBy = 'Matt';
  workbook.created = new Date(2017, 7, 13);
  workbook.modified = new Date();
  workbook.lastPrinted = new Date(2017, 4, 27);

  let excelSheet = workbook.addWorksheet('DTLOC Sheet', {
    views: [{ xSplit: 1 }], pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  excelSheet.columns = colSettings

    let count = 0, loc = 0,  allData = {};
  _.each(data, (subData,val) => {
    if (subData.year) {
      let dtSuffix = count > 0 ? '_' + count : '';
      allData[`year${dtSuffix}`] = subData.year;
      allData[`month${dtSuffix}`] = subData.month;
      allData[`day${dtSuffix}`] = subData.day;
      allData[`assess_time${dtSuffix}`] = subData.assess_time;
      count++;
      return ;
    }
    _.each(subData, (item, ind) => {
      let locSuffix = loc > 0 ? '_' + loc : '';
      let key = `${val}_${ind}${locSuffix}`;
      allData[key] = item;
    });
    loc++;
  });

  excelSheet.addRow(allData);

  let creationTime = new Date().toISOString();
  let filename = `testcsvfile-${creationTime}.xlsx`;

  // create and fill Workbook;
  workbook.xlsx.writeFile(filename, 'utf8')
    .then(() => console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓')))
    .catch((err) => console.error(err));

  return;

}

function getResultCollection() {
  _.forEach(allData, function(data) {
    _.filter(data.doc, function(item, index) {
      if (typeof item === 'object') {
        // console.log(index);
        if (index === 'device') {
          let deviceKey = Object.keys(item)[0];
          deepHeaders.push({ header: deviceKey, key: deviceKey });
        }
        if (index === 'order_map') {
          deepHeaders.push({ header: index, key: index });
        }
        if (index === 'subtestData') {
          _.forEach(item, (subData, key) => {
            if (subData.prototype === 'location') {
              _.forEach(subData.data.labels, (subItem) => {
                deepHeaders.push({ header: subItem, key: subItem });
              });
              return;
            }
            if (subData.prototype === 'datetime') {
              datetimeSuffix = datetimeCount > 0 ? '_' + datetimeCount : '';
              // let datetimeKey = datetimeCount > 0 ? dateIndex + datetimeSuffix : dateIndex;
              _.forEach(subData.data, (dateData, dateIndex) => {
                deepHeaders.push({ header: dateIndex + datetimeSuffix, key: dateIndex + datetimeSuffix });
              });
              datetimeCount++;
              return;
            }
            if (subData.prototype === 'survey') {
              _.forEach(subData.data, (surveyItem, surveryKey) => {
                deepHeaders.push({ header: surveryKey, key: surveryKey });
              });
              return;
            }
            if (subData.prototype === 'grid') {
              _.forEach(subData.data, (gridData, gridKey) => {
                if (gridKey !== 'items') {
                  deepHeaders.push({ header: gridKey, key: gridKey });
                } else {

                }
              });
            }
            if (subData.prototype === 'complete') {
              _.forEach(subData.data, (completeData, completeKey) => {
                deepHeaders.push({ header: completeKey, key: completeKey });
              });
              return;
            }
          });
        }
      } else {
        simpleHeaders.push({ header: index, key: index });
      }
    })
  })
  simpleHeaders = _.uniqWith(simpleHeaders, _.isEqual);
  deepHeaders = _.uniqWith(deepHeaders, _.isEqual);

  res.json({ subtest, simpleHeaders, deepHeaders });
}

// Creates column settings for CSV generation
function generateColumnSettings(doc) {
  return _.map(doc, (data) => {
    return { header: data.toUpperCase(), key: data }
  });
}
