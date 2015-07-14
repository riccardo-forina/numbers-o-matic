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
var util = require('util');

module.exports = function(config, kind) {

  var ds = gcloud.datastore.dataset(config.gcloud);

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
  function toDatastore(obj, nonIndexed) {
    nonIndexed = nonIndexed || [];
    var results = [];
    Object.keys(obj).forEach(function(k) {
      if (obj[k] === undefined) return;
      results.push({
        name: k,
        value: obj[k],
        excludeFromIndexes: nonIndexed.indexOf(k) !== -1
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
  function list(limit, token, order, cb) {
    var q = ds.createQuery([kind])
      .limit(limit)
      .start(token);

    if (order) {
      q.order(order);
    }

    ds.runQuery(q, function(err, entities, cursor) {
      if (err) return cb(err);
      cb(null, entities.map(fromDatastore), entities.length === limit ? cursor : false);
    });
  }

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
        if (cb) cb(err, err ? null : entity);
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
      cb(null, fromDatastore(entity));
    });
  }

  function _delete(id, cb) {
    var key = ds.key([kind, id]);
    ds.delete(key, cb);
  }

  function query(makeQueryCb, cb) {
    var q = makeQueryCb(ds.createQuery([kind]));
    ds.runQuery(q, function (err, entities) {
      if (err) return cb(err);
      cb(null, entities.map(fromDatastore));
    });
  }

  return {
    create: function(data, cb) {
      update(null, data, cb);
    },
    read: read,
    update: update,
    delete: _delete,
    list: list,
    query: query
  };

};
