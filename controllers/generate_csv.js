// Module dependencies.
const _ = require('lodash');
const chalk = require('chalk');
const Excel = require('exceljs');
const nano = require('nano');

let BASE_DB, RESULT_DB;
const createHeaders = require('./assessment').createColumnHeaders;
const processResult = require('./result').generateResult;

/**
 * GET /generate/:id
 * generate csv for a particular workflow id
*/
exports.generate = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  RESULT_DB = nano(req.body.result_db);
  let docId = req.params.id;
  let resultDocId = req.body.resultId;
  let docHeaders;

  getResultHeaders(docId)
    .then((data) => {
      docHeaders = data;
      return getProcessedResult(resultDocId);
    })
    .then((result) => {
      let genCSV = generateCSV(docHeaders, result);
      res.json(result);
    })
    .catch((err) => Error(err));
}

// Get result headers from result_db
const getResultHeaders = function(docId) {
  return new Promise((resolve, reject) => {
    RESULT_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

// Generate CSV file
const generateCSV = function(colSettings, resultData) {
  let workbook = new Excel.Workbook();
  workbook.creator = 'Brockman';
  workbook.lastModifiedBy = 'Matthew';
  workbook.created = new Date(2017, 9, 1);
  workbook.modified = new Date();
  workbook.lastPrinted = new Date(2017, 7, 27);

  let excelSheet = workbook.addWorksheet('Workflow Sheet', {
    views: [{ xSplit: 1 }], pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  excelSheet.columns = colSettings.column_headers;

  excelSheet.addRow(resultData.processed_results);

  let creationTime = new Date().toISOString();
  let filename = `testcsvfile-${creationTime}.xlsx`;

  // create and fill Workbook;
  workbook.xlsx
    .writeFile(filename, 'utf8')
    .then(() => {
      console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓'));

      return { message: 'CSV Successfully Generated' };
    })
    .catch((err) => Error(err));

}

// Retrieve processed result by Id from RESULT DB
function getProcessedResult(docId) {
  return new Promise((resolve, reject) => {
    RESULT_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

exports.generateCSV = generateCSV;
