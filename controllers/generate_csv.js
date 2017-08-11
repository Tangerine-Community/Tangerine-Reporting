// Module dependencies.
const _ = require('lodash');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const createHeaders = require('./assessment').createColumnHeaders;
const processResult = require('./result').generateResult;


exports.generate = (req, res) => {
  let docHeaders;
  let docId = req.params.id;

  getResultHeaders(docId)
    .then((data) => {
      docHeaders = data;
      return getProcessedResult(docId);
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

  let excelSheet = workbook.addWorksheet('Result Sheet', {
    views: [{ xSplit: 1 }], pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  excelSheet.columns = colSettings.column_headers;

  excelSheet.addRow(resultData);

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
  let key = `${docId}-result`
  return new Promise((resolve, reject) => {
    RESULT_DB.get(key, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

exports.generateCSV = generateCSV;
