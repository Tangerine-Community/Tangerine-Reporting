/**
 * This file generates a CSV file.
 *
 * Module: generateCSV
 */

/**
 * Module dependencies
 */

const chalk = require('chalk');
const Excel = require('exceljs');
const nano = require('nano');

/**
 * Local modules.
 */

const dbQuery = require('./../utils/dbQuery');
const resultDB = require('./../config').resultDb;

/**
 * Generates a CSV file.
 *
 * Example:
 *
 *    POST  /generate_csv/:id/:db_name/:year?/:month?
 *    GET   /generate_csv/:id/:db_name/:year?/:month?
 *
 *  where id refers to the id of the generated document in the result database.
 *  and db_name is the result database name
 *  year and month are the respective year and month the result was conducted.
 *
 * Response:
 *
 *  Returns a csv file to be downloaded.
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 */

exports.generate = (req, res) => {
  let groupName = req.params.db_name || resultDB;
  let resultDbUrl = groupName.includes('http') ? groupName : 'http://localhost:5984/' + groupName + '-result';

  let resultId = req.params.id || req.body.workflowId;
  let resultYear = req.params.year || req.body.year;
  let resultMonth = req.params.month || req.body.month;

  resultMonth = resultMonth ? resultMonth : false;
  resultMonth = resultMonth ? resultMonth[0].toUpperCase() + resultMonth.substr(1, 2) : false;

  let queryId = resultMonth && resultYear ? `${resultId}_${resultYear}_${resultMonth}`: resultId;

  dbQuery.retrieveDoc(resultId, resultDbUrl)
    .then(async(docHeaders) => {
      const result = await dbQuery.getProcessedResults(queryId, resultDbUrl);
      generateCSV(docHeaders, result, res);
    })
    .catch((err) => err);
}

/**
 * This function creates a CSV file.
 *
 * @param {Object} columnData – column headers
 * @param {Array} resultData – the result data.
 * @param {Object} res – response object.
 *
 * @returns {Object} – generated response
 */

const generateCSV = function(columnData, resultData, res) {
  const FILENAME = columnData.name.replace(/\s/g, '_');
  let workbook = new Excel.Workbook();
  workbook.creator = 'Tangerine';

  let excelSheet = workbook.addWorksheet('Tangerine Sheet', {
    views: [{ xSplit: 1 }],
    pageSetup: { paperSize: 9, orientation: 'landscape' }
  });

  // Add column headers and define column keys
  excelSheet.columns = columnData.column_headers;

  // Add rows by key-value using the column keys
  resultData.forEach(function(row) {
    excelSheet.addRow(row.doc.processed_results);
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${FILENAME}.xlsx`);
  workbook.xlsx.write(res).then(function(data) {
    console.log(chalk.green(`✓ You have successfully created "${FILENAME}.xlsx" file at ${new Date()}`));
    res.end();
  });
}

exports.generateCSV = generateCSV;
