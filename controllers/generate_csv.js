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
const dbQuery = require('./../utils/dbQuery');

/**
 * Generates a CSV file.
 *
 * Example:
 *
 *    POST /generate_csv
 *
 *  The request object must contain the result database url,
 *  generated header document id and the processed result document id.
 *       {
 *         "another_url": "http://admin:password@test.tangerine.org/database_name"
 *         "generated_header_doc_id": "0000B40F-4F39-494E-A363-D04F5EFA4744"
 *         "processed_result_doc_id": "e61318ac-e134-0321-9c23-a9e60fc8a6ae"
 *       }
 *
 * Response:
 *
 *  Returns the processed result.
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.generate = (req, res) => {
  const resultDbUrl = req.body.result_db;
  const headerDocId = req.body.headerId;
  const resultDocId = req.body.resultId;

  dbQuery.retrieveDoc(headerDocId, resultDbUrl)
    .then(async(docHeaders) => {
      const result = await dbQuery.retrieveDoc(resultDocId, resultDbUrl);
      generateCSV(docHeaders, result);
      res.json({ message: 'CSV Successfully Generated' });
    })
    .catch((err) => Error(err));
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

  // Add column headers and define column keys
  excelSheet.columns = colSettings.column_headers;

  // Add rows by key-value using the column keys
  excelSheet.addRow(resultData.processed_results);

  let creationTime = new Date().toISOString();
  let filename = `testcsvfile-${creationTime}.xlsx`;

  // create and fill Workbook;
  workbook.xlsx.writeFile(filename, 'utf8')
    .then(() => {
      console.log(`%s You have successfully created a new excel file at ${new Date()}`, chalk.green('✓'));
    })
    .catch((err) => Error(err));

}

exports.generateCSV = generateCSV;
