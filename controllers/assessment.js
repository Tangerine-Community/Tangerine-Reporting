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
    .then((data) => {
      _.each(data, (item) => {
        assessments.push({ key: item.doc.assessmentId + '.id', header: 'ID'});
        assessments.push({ key: item.doc.assessmentId + '.name', header: 'Name' });
      });
      return getSubtests();
    })
    .then((data2) => {
      let result =  assessments.concat(data2);
      res.json(result)
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

