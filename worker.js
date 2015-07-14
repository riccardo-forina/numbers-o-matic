/*
	Copyright 2015, Google, Inc.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
"use strict";

var request = require('request');
var express = require('express');
var config = require('./config');

var logging = require('./lib/logging')(config.logPath);
var background = require('./lib/background')(config.gcloud, logging);

var simulationBatch = require('./simulation/models/simulationBatch')(config);

/* Keep count of how many numbers this worker has processed */
var simulationsCount = 0;

/*
  When running on Google App Engine Managed VMs, the worker needs
  to respond to health checks. We can re-use the health checks
  from the main application and create a simple server.
*/
// [START server]
var app = express();

app.use(logging.requestLogger);
app.use(require('./lib/appengine-handlers'));

app.get('/', function(req, res) {
  res.send('This worker has processed ' + simulationsCount + ' simulations.');
});

app.use(logging.errorLogger);

var server = app.listen(config.port, '0.0.0.0', function() {
  console.log('Worker server listening at http://%s:%s', server.address().address, server.address().port);
  console.log("Press Ctrl+C to quit.");
});
// [END server]


/*
  Subscribe to Cloud Pub/Sub and recieve messages to process numbers.
  The subscription will continue to listen for messages until the server
  is killed.
*/
// [START subscribe]
background.subscribe(function(message) {
  if (message.action == 'processSimulation') {
    logging.info('Received request to process simulation ' + message.simulationId + ' batch ' + message.batchId + '/' + message.batchNumber);
    processSimulationBatch(message.simulationId, message.batchId, message.batchNumber, function(err) {
      if (err) logging.error(err)
      simulationsCount += 1;
    });
  } else {
    logging.warn('Unknown request', message);
  }
});
// [END subscribe]

function processSimulationBatch(simulationId, batchId, batchNumber, cb) {
  logging.info("Processing simulation batch", simulationId, batchId, batchNumber);
  var hrstart = process.hrtime();
  var min = 0,
      max = 50;

  var numbers = [];
  for (var i = 0; i < 1000; i++) {
    numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  var diff = process.hrtime(hrstart);
  var entity = {
    simulation: simulationId,
    numbers: numbers,
    computationTime: diff[0] * 1e9 + diff[1],
  };

  simulationBatch.update(simulationId + '-' + batchId, entity, cb);
}
