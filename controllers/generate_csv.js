/**
 * This file generates a CSV file.
 * It also exposes the generateCSV module.
 */

/**
 * Module dependencies
 */
const _ = require('lodash');
const chalk = require('chalk');
const Excel = require('exceljs');
const nano = require('nano');

/**
 * Declare database variables.
 */
let BASE_DB, RESULT_DB;

/**
 * Local modules.
 */
const createHeaders = require('./assessment').createColumnHeaders;
const processResult = require('./result').generateResult;

/**
 * POST /generate
 * generate a csv file.
*/
exports.generate = (req, res) => {
  BASE_DB = nano(req.body.base_db);
  RESULT_DB = nano(req.body.result_db);
  let headerDocId = req.body.headerId;
  let resultDocId = req.body.resultId;
  let docHeaders;

  getDocument(headerDocId)
    .then((data) => {
      docHeaders = data;
      return getDocument(resultDocId);
    })
    .then((result) => {
      let genCSV = generateCSV(docHeaders, result);
      res.json(result);
    })
    .catch((err) => Error(err));
}

/**
 * This function retrieves a document from the database.
 * @param {string} docId id of document.
 * @returns {Object} retrieved document.
 */
const getDocument = function(docId) {
  return new Promise((resolve, reject) => {
    RESULT_DB.get(docId, (err, body) => {
      if (err) reject(err);
      resolve(body);
    });
  });
}

/**
 * This function generates a CSV file.
 * @param {Object, Object} [colSettings,resultData] headers and result data.
 * @returns {Object} retrieved document.
 */
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

exports.generateCSV = generateCSV;
