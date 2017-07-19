/**
 * Module dependencies.
 */

const _ = require('lodash');
const Excel = require('exceljs');

/**
 * Connect to Couch DB
 */
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');

/*
 *  Define variables for column headers
*/
let subtestCollections, questionCollections, assessmentCollections, allCollections;

/*
 * Creates headers for CSV columns
*/
function generateColumnHeaders (data) {
  let ans = [];
  _.forEach(data, (values) => {
    let keys =_.keysIn(values.doc);
    _.forEach(keys, (val) => {
      ans.push(val);
    });
  });
  return _.uniq(ans);
}

/*
 *  Creates column settings for CSV generation
*/
function genereateColumnSettings (doc) {
  return _.map(doc, (data) => {
    return { header: data.toUpperCase(), key: data }
  });
}

/**
 * GET /assessnent
 * Retrieve all assessments
 */
exports.getAll = (req, res) => {
  // TODO: Promisify these queries
  TMP_TANGERINEDB.view('ojai', 'subtestsByAssessmentId', { include_docs: true }, (err, body) => {
    if (err) return res.send(err);
    subtestCollections = _.clone(body.rows);

    TMP_TANGERINEDB.view('ojai', 'questionsByParentId', { include_docs: true }, (err, body) => {
      if (err) return res.send(err);
      questionCollections = _.clone(body.rows);

      TMP_TANGERINEDB.view('ojai', 'byCollection', { key: 'assessment', include_docs: true }, (err, body) => {
        if (err) return res.send(err);
        assessmentCollections = _.clone(body.rows);
        allCollections = subtestCollections.concat(questionCollections).concat(assessmentCollections);
        let colHeaders = generateColumnHeaders(allCollections);
        let colSettings = genereateColumnSettings(colHeaders);

        res.json({ colHeaders, colSettings });
      });
    });
  });

}

/**
 * GET /assessment/:id
 * Retrieve a single assessment doc
 */
exports.getAssessment = (req, res) => {
  TMP_TANGERINEDB.get(req.params.id, (err, body) => {
    if (err) return res.send(err);
    res.json(body)
  });
}

/**
 * GET /assessment/results
 * Retrieve all result collection
 */
exports.getResults = (req, res) => {
  TMP_TANGERINEDB.list({ include_docs: true }, (err, body) => {
    if (err) return res.send(err);

    let resultCollections = _.filter(body.rows, (data) => data.doc.collection === 'result');

    res.json({ length: resultCollections.length, results: resultCollections.slice(18, 20) });
  });
}

/**
 * GET /assessment/questions
 * Retrieve all question collection
 */
exports.getQuestions = (req, res) => {
  TMP_TANGERINEDB.list({ include_docs: true }, (err, body) => {
    if (err) return res.send(err);

    let questionCollections = _.filter(body.rows, (data) => data.doc.collection === 'question' );

    res.json({ length: questionCollections.length, results: questionCollections });
  });
}

/**
 * GET /assessment/subtests
 * Retrieve all subtest collection
 */
exports.getSubtests = (req, res) => {
  TMP_TANGERINEDB.list({ include_docs: true }, (err, body) => {
    if (err) return res.send(err);

    let subtestCollections = _.filter(body.rows, (data) => data.doc.collection === 'subtest');

    res.json({ length: subtestCollections.length, results: subtestCollections });
  });
}


/*
 *Ignore these functions below
*/
function generateCSV () {

  var columnData;
  var allDB = [];
  let columnHeaders;

  // TODO: Remove this query
  TMP_TANGERINEDB.list({ include_docs: true }, (err, body) => {
    if (err) return res.send(err);

    // Get a single result collection document
    let first = _.find(body.rows, (data) => { return data.doc.collection === 'result'; });

    // Get the keys for a result document. To be used as excel column headers
    columnHeaders = _.keysIn(first.doc);
    columnHeaders.shift();
    columnHeaders.shift();

    // Get all collections that are result
    let resultCollections = _.filter(body.rows, (data) => data.doc.collection === 'result');

    let workbook = new Excel.Workbook();
    workbook.creator = 'Brockman';
    workbook.lastModifiedBy = 'Matt';
    workbook.created = new Date(2017, 7, 13);
    workbook.modified = new Date();
    workbook.lastPrinted = new Date(2017, 4, 27);
    workbook.views = [{
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 1,
      visibility: 'visible'
    }];

    let excelSheet = workbook.addWorksheet('Sample Sheet', {
      views: [{ xSplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    let columnSettings = _.map(columnHeaders, (col) => {
      return { header: col.toUpperCase(), key: col }
    });

    excelSheet.columns = columnSettings;
    let rowData = resultCollections.slice(0, 100);

    _.each(rowData, (data) => {
      excelSheet.addRow(data.doc)
    });

    let creationTime = new Date().toISOString();
    let filename = `testcsvfile-${creationTime.slice(0, creationTime.indexOf('T'))}.xlsx`;

    // let workbook = createAndFillWorkbook();
    workbook.xlsx.writeFile(filename, 'utf8')
      .then(() => console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓')))
      .catch((err) => console.error(err));

    // res.json({ columnsSettings });
    res.json({ columnHeaders, results: resultCollections.slice(98, 100) });
  })

}


function getResultCollection() {
  _.forEach(allData, function(data) {
    _.filter(data.doc, function(item, index) {
      if (typeof item ===  'object') {
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
      }
      else {
        simpleHeaders.push({ header: index, key: index });
      }
    })
  })
  simpleHeaders = _.uniqWith(simpleHeaders, _.isEqual);
  deepHeaders = _.uniqWith(deepHeaders, _.isEqual);

  res.json({ subtest, simpleHeaders, deepHeaders });
}

