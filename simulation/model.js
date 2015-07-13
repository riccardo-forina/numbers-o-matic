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

var gcloud = require('gcloud');

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

  var ds = gcloud.datastore.dataset(config.gcloud);
  var kind = 'Simulation';


  /*
    Translates from Datastore's entity format to
    the format expected by the application.

    Datastore format:
      {
        key: [kind, id],
        data: {
          property: value
        }
      }

    Application format:
      {
        id: id,
        property: value
      }
  */
  function fromDatastore(obj) {
    obj.data.id = obj.key.path[obj.key.path.length - 1];
    return obj.data;
  }


  /*
    Translates from the application's format to the datastore's
    extended entity property format. It also handles marking any
    specified properties as non-indexed. Does not translate the key.

    Application format:
      {
        id: id,
        property: value,
        unindexedProperty: value
      }

    Datastore extended format:
      [
        {
          name: property,
          value: value
        },
        {
          name: unindexedProperty,
          value: value,
          excludeFromIndexes: true
        }
      ]
  */
  function toDatastore(obj) {
    var results = [];
    Object.keys(obj).forEach(function(k) {
      if (obj[k] === undefined) return;
      results.push({
        name: k,
        value: obj[k],
        excludeFromIndexes: k !== 'date'
      });
    });
    return results;
  }


  /*
    Lists all simulations in the Datastore sorted by date.
    The ``limit`` argument determines the maximum amount of results to
    return per page. The ``token`` argument allows requesting additional
    pages. The callback is invoked with ``(err, simulations, nextPageToken)``.
  */
  function list(limit, token, cb) {
    var q = ds.createQuery([kind])
      .limit(limit)
      .order('-date')
      .start(token);

    ds.runQuery(q, function(err, entities, cursor) {
      if (err) return cb(err);
      if(cb) cb(null, entities.map(fromDatastore), entities.length === limit ? cursor : false);
    });
  }

  function create(cb) {
    var key = ds.key(kind);
    var entity = {
      key: key,
      data: toDatastore({
        date: new Date()
      })
    };

    ds.save(
      entity,
      function(err) {
        cb(err, err ? null : fromDatastore(entity));
        background.newSimulation(entity.key.path[entity.key.path.length - 1]);
      }
    );
  }

  /*
    Updates an existing Simulation with new data. The provided
    data is automatically translated into Datastore format.
  */
  function update(id, data, cb) {
    var key;
    if (id) {
      key = ds.key([kind, id]);
    } else {
      key = ds.key(kind);
    }

    var entity = {
      key: key,
      data: toDatastore(data)
    };

    ds.save(entity, function(err) {
        if (cb) cb(err, err ? null : fromDatastore(entity));
    });
  }

  function read(id, cb) {
    var key = ds.key([kind, id]);
    ds.get(key, function(err, entity) {
      if (err) return cb(err);
      if (!entity) return cb({
        code: 404,
        message: "Not found"
      });

      entity = fromDatastore(entity);
      // check if we previously saved the entity with the computed data
      // if not, compute it from the available batches
      if (entity.completed) {
        cb(null, entity);
      } else {
        var hrstart = process.hrtime();

        var simulation = {
          date: entity.date,
          generatedNumbersCount: 0,
          uniqueNumbers: [],
          numbersCount: (new Array(51)).fill(0),
          sum: 0,
          avg: 0,
          mostFrequentNumber: 0,
          computationTime: 0,
          completed: 0
        };

        var q = ds.createQuery(['SimulationBatch'])
          .filter('simulation =', parseInt(id, 10));

        ds.runQuery(q, function (err, batches, cursor) {
          if (err) return cb(err);
          batches.forEach(function (batch) {
            batch = fromDatastore(batch);
            batch.numbers.forEach(function (n) {
              simulation.generatedNumbersCount += 1;
              // add it to the list of unique numbers if not present
              if (simulation.uniqueNumbers.indexOf(n) < 0) {
                simulation.uniqueNumbers.push(n);
              }
              // increase the number of occurrences of the number
              simulation.numbersCount[n] = (simulation.numbersCount[n] || 0) + 1;
              // add the number to the total sum
              simulation.sum += n;
              // and calculate the new average
              simulation.avg = simulation.sum / simulation.generatedNumbersCount;
              // check if n is the most frequent number (TODO: what if we have more than one number with the same count?)
              simulation.mostFrequentNumber = (simulation.numbersCount[simulation.mostFrequentNumber] || 0) < simulation.numbersCount[n]
                ? n
                : simulation.mostFrequentNumber;
            })
            simulation.computationTime += batch.computationTime;
            simulation.completed += 1;
          })
          // consider also this in the computation time
          var diff = process.hrtime(hrstart);
          simulation.computationTime += diff[0] * 1e9 + diff[1];
          if (simulation.completed === 100) {
            update(id, simulation);
          }
          cb(null, simulation);
        });
      }
    });
  }

  function _delete(id, cb) {
    var key = ds.key([kind, id]);
    ds.delete(key, cb);
  }

  return {
    create: create,
    read: read,
    update: update,
    delete: _delete,
    list: list
  };

};
