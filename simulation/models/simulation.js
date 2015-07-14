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

if (!Array.prototype.fill) {
  Array.prototype.fill = function(value) {

    // Steps 1-2.
    if (this == null) {
      throw new TypeError('this is null or not defined');
    }

    var O = Object(this);

    // Steps 3-5.
    var len = O.length >>> 0;

    // Steps 6-7.
    var start = arguments[1];
    var relativeStart = start >> 0;

    // Step 8.
    var k = relativeStart < 0 ?
      Math.max(len + relativeStart, 0) :
      Math.min(relativeStart, len);

    // Steps 9-10.
    var end = arguments[2];
    var relativeEnd = end === undefined ?
      len : end >> 0;

    // Step 11.
    var final = relativeEnd < 0 ?
      Math.max(len + relativeEnd, 0) :
      Math.min(relativeEnd, len);

    // Step 12.
    while (k < final) {
      O[k] = value;
      k++;
    }

    // Step 13.
    return O;
  };
}


module.exports = function(config, background) {

  var simulation = require('./model-datastore')(config, 'Simulation');
  var simulationBatch = require('./simulationBatch')(config);

  function create(user, cb) {
    simulation.create({
        date: new Date(),
        user: user
      }, function(err, entity) {
      if (err) return cb(err)
      background.newSimulation(entity.key.path[entity.key.path.length - 1]);
      cb(null, entity);
    })

  }

  function read(id, cb) {
    simulation.read(id, function(err, entity) {
      if (err) return cb(err)

      // check if we previously saved the entity with the computed data
      // if not, compute it from the available batches
      if (entity.completed) {
        cb(null, entity);
      } else {
        var hrstart = process.hrtime();

        var simulationData = {
          date: entity.date,
          user: entity.user,
          generatedNumbersCount: 0,
          uniqueNumbers: [],
          numbersCount: (new Array(51)).fill(0),
          sum: 0,
          avg: 0,
          mostFrequentNumber: 0,
          computationTime: 0,
          completed: 0
        };

        simulationBatch.query(
          function(q) {
            return q.filter('simulation =', parseInt(id, 10));
          },
          function (err, batches) {
            if (err) return cb(err);
            batches.forEach(function (batch) {
              batch.numbers.forEach(function (n) {
                simulationData.generatedNumbersCount += 1;
                // add it to the list of unique numbers if not present
                if (simulationData.uniqueNumbers.indexOf(n) < 0) {
                  simulationData.uniqueNumbers.push(n);
                }
                // increase the number of occurrences of the number
                simulationData.numbersCount[n] = (simulationData.numbersCount[n] || 0) + 1;
                // add the number to the total sum
                simulationData.sum += n;
                // and calculate the new average
                simulationData.avg = simulationData.sum / simulationData.generatedNumbersCount;
                // check if n is the most frequent number (TODO: what if we have more than one number with the same count?)
                simulationData.mostFrequentNumber = (simulationData.numbersCount[simulationData.mostFrequentNumber] || 0) < simulationData.numbersCount[n]
                  ? n
                  : simulationData.mostFrequentNumber;
              })
              simulationData.computationTime += batch.computationTime;
              simulationData.completed += 1;
            })
            // consider also this in the computation time
            var diff = process.hrtime(hrstart);
            simulationData.computationTime += diff[0] * 1e9 + diff[1];
            if (simulationData.completed === 100) {
              simulation.update(id, simulationData);
            }
            cb(null, simulationData);
          }
        );
      }
    })
  }

  return {
    create: create,
    read: read,
    update: simulation.update,
    delete: simulation.delete,
    list: simulation.list
  };
};
