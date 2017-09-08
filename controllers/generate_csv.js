/**
 * This file generates a CSV file.
 *
 * Module: generateCSV
 */

/**
 * Module dependencies
 */

const _ = require('lodash');
const chalk = require('chalk');
const Excel = require('exceljs');
const nano = require('nano');

/**
 * Local modules.
 */

const createHeaders = require('./assessment').createColumnHeaders;
const processResult = require('./result').generateResult;

/**
 * Generates a CSV file.
 *
 * Example:
 *
 *    POST /generate_csv
 *
 *  The request object must contain the database url, result database url,
 *  generated header document id and the processed result document id.
 *       {
 *         "db_url": "http://admin:password@test.tangerine.org/database_name"
 *         "another_url": "http://admin:password@test.tangerine.org/database_name"
 *         "generated_header_doc_id": "0000B40F-4F39-494E-A363-D04F5EFA4744"
 *         "processed_result_doc_id": "e61318ac-e134-0321-9c23-a9e60fc8a6ae"
 *       }
 *
 * Response:
 *
 * Returns the processed result.
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.generate = (req, res) => {
  const dbUrl = req.body.base_db;
  const resultDbUrl = req.body.result_db;
  const headerDocId = req.body.headerId;
  const resultDocId = req.body.resultId;

  getDocument(headerDocId, dbUrl)
    .then(async(docHeaders) => {
      const result = await getDocument(resultDocId, dbUrl);
      generateCSV(docHeaders, result);
      res.json(result);
    })
    .catch((err) => Error(err));
}

/**
 * This function retrieves a document from the database.
 *
 * @param {string} docId - id of document.
 * @param {string} dbUrl - database url.
 *
 * @returns {Object} - retrieved document.
 */

const getDocument = function(docId, dbUrl) {
  const RESULT_DB = nano(dbUrl);
  return new Promise((resolve, reject) => {
    RESULT_DB.get(docId, (err, body) => {
      if (err) {
        reject(err);
      }
      resolve(body);
    });
  });
}

/**
 * This function creates a CSV file.
 *
 * @param {Object} colSettings – column headers
 * @param {Object} resultData – the result data.
 *
 * @returns {Object} – retrieved document.
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
  workbook.xlsx.writeFile(filename, 'utf8')
    .then(() => {
      console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓'));
      return { message: 'CSV Successfully Generated' };
    })
    .catch((err) => Error(err));

}

exports.generateCSV = generateCSV;
