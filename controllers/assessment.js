/**
 * Module dependencies.
 */

const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

/**
 * Connect to Couch DB
 */
const nano = require('nano');
const TMP_TANGERINEDB = nano('http://localhost:5984/tmp_tangerine');


/*
 *  Creates column settings for CSV generation
*/
function generateColumnSettings (doc) {
  return _.map(doc, (data) => {
    return { header: data.toUpperCase(), key: data }
  });
}

let sampleData = [
  {
    "name": "Tanggal Penilaian ",
    "data": {
      "year": "2017",
      "month": "apr",
      "day": "4",
      "time": "9:10"
    },
    "subtestHash": "QCAbEhoJSnCWrmClC2mwAD2Ziow=",
    "subtestId": "074a96b6-8835-2e3c-6b41-e8a678d56987",
    "prototype": "datetime",
    "timestamp": 1491268239410
  },
  {
    "name": "Mangalla Arigonna ",
    "data": {
      "year": "2017",
      "month": "apr",
      "day": "14",
      "time": "9:48"
    },
    "subtestHash": "QCAbEhoJSnCWrmClC2mwAD2Ziow=",
    "subtestId": "1aa909d2-8835-2e3c-6b41-e8a678d56987",
    "prototype": "datetime",
    "timestamp": 1491268239410
  },
  {
    "name": "Asgard Thorain ",
    "data": {
      "year": "2017",
      "month": "apr",
      "day": "7",
      "time": "6:48"
    },
    "subtestHash": "QCAbEhoJSnCWrmClC2mwAD2Ziow=",
    "subtestId": "3c8892ad-8835-2e3c-6b41-e8a678d56987",
    "prototype": "datetime",
    "timestamp": 1491268239410
  }
]

// Generate header for datetime protype subtest
function createDatetimeHeader (data) {
  let datetimeCount = 0;
  let suffix;
  let datetimeHeader = [];
  _.each(data, (doc) => {
    suffix = datetimeCount > 0 ? '_' + datetimeCount : '';
    datetimeHeader.push({ header: `year${suffix}`, key: `year${suffix}` });
    datetimeHeader.push({ header: `month${suffix}`, key: `month${suffix}` });
    datetimeHeader.push({ header: `day${suffix}`, key: `day${suffix}` });
    datetimeHeader.push({ header: `assess_time${suffix}`, key: `assess_time${suffix}` });
    datetimeCount++;
  });
  return datetimeHeader;
}


// Process subtestData for datetime prototype 
function processDatetimeResult (body) {
  let processedData = [];
  _.each(body, (doc) => {
    let datetimeResult = {};
    datetimeResult[doc.subtestId] = {
      year : doc.data.year,
      month: doc.data.month,
      day: doc.data.day,
      assess_time: doc.data.time
    }
    processedData.push(datetimeResult);
  });

  return processedData;
}


exports.getAll = (req, res) => {
  let result = createDatetimeHeader(sampleData);
  let processed = processDatetimeResult(sampleData);

  res.json({ result, processed });
}


/*
 *Ignore these functions below
*/
function generateCSV () {

  var columnData;
  var allDB = [];
  let columnHeaders;

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

    let excelSheet = workbook.addWorksheet('Test Sheet', {
      views: [{ xSplit: 1 }],
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });


    let a = 0;
    let columnSettings = _.each(body, (col, ind) => {
      if (typeof col === 'object') {
        let arr = _.keysIn(col);
        while (a < arr.length) {
          allDB.push({ header: `${arr[a]}-${String(a)}`, key: `arr[a]-${String(a)}` });
          a++;
        }
        return;
      }
      allDB.push({ header: ind, key: ind });
    });
    // console.log('sets:', columnSettings);
    console.log('sets:', allDB);
    // let ars = {
    //   data: { yes: 'name' }
    // };
    // var sars = Object.keys(ars.data)[0];

    excelSheet.columns = allDB;
    // let rowData = resultCollections.slice(0, 100);

    _.each(body, (doc, col) => {
      if (typeof doc === 'object') {
        excelSheet.addRow({key: 2, undefined: 'bill'})
        return;
      }
      excelSheet.addRow({id: 2, undefined: 'bill'})
      // console.log('ROW', excelSheet.getRow(2).values);
    });

    let creationTime = new Date().toISOString();
    let filename = `testcsvfile-${creationTime.slice(0, creationTime.indexOf('T'))}.xlsx`;

    // let workbook = createAndFillWorkbook();
    workbook.xlsx.writeFile(filename, 'utf8')
      .then(() => console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓')))
      .catch((err) => console.error(err));

    // res.json({ columnsSettings });
    // res.json({ columnHeaders, results: resultCollections.slice(98, 100) });
  // })

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

