// Module dependencies.
const _ = require('lodash');
const Excel = require('exceljs');
const chalk = require('chalk');

// Connect to Couch DB
const nano = require('nano');
const TMP_TANGERINE = nano('http://localhost:5984/tmp_tangerine');
const RESULT_DB = nano('http://localhost:5984/tang_resultdb');
const TAYARI_BACKUP = nano('http://localhost:5984/tayari_backup');

const generateHeaders = require('./assessment').createColumnHeaders;
const processResult = require('./result').generateResult;
const processWorflowHeaders = require('./workflow').createWorkflowHeaders;

/**
 * GET /tangerine_changes
 * process headers and result of changed document
*/
exports.changes = (req, res) => {
  let feed = TMP_TANGERINE.follow({since: 'now'});
  feed.on('change', function (change) {
    console.log('change: ', change);

    retrieveChangeDoc(change.id)
      .then((data) => {
        res.json(data);
        if (data.collection === 'result') {
          processResult(data.assessmentId);
        }
        if (data.collection === 'workflow') {
          processWorflowHeaders(data.workflowId);
        }
        if (data.collection === 'assessment') {
          generateHeaders(data.assessmentId);
        }
        if (data.collection === 'curriculum') {
          generateHeaders(data.curriculumId);
        }
        if (data.collection === 'question') {
          generateHeaders(data.assessmentId);
        }
        if (data.collection === 'subtest') {
          generateHeaders(data.assessmentId);
        }
      })
      .catch((err) => res.send(Error(err)));
  });

  feed.follow();

  process.nextTick(function () {
    let ans = Math.random() * 2000;
    TMP_TANGERINE.insert({ [`mel-${ans}`]: "baz"},  `mel-${ans}`);
  });
}

function retrieveChangeDoc(docId) {
  return new Promise((resolve, reject) => {
    TMP_TANGERINE.get(docId, (err, body) => {
      if(err) reject(err);
      resolve(body);
    })
  });
}
