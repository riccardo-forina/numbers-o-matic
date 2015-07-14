"use strict";

var express = require('express');

module.exports = function(model, oauth2) {
  var router = express.Router();

  /*
   Use the oauth middleware to automatically get the user's profile information
   and expose login/logout URLs to templates.
   */
  router.use(oauth2.required);
  router.use(oauth2.aware);
  router.use(oauth2.template);


  function handleRpcError(err, res) {
    res.status(err.code || 500).send(err.message);
  }


  router.use(function(req, res, next){
    res.set('Content-Type', 'text/html');
    next();
  });


  router.get('/', function index(req, res) {
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      model.list(100, req.query.pageToken, '-date',
        function(err, entities, cursor) {
          if (err) return handleRpcError(err, res);
          res.json({
            simulations: entities,
            nextPageToken: cursor
          });
        }
      );
    } else {
      res.render('simulation/index.jade');
    }
  });

  router.post('/', function startSimulation(req, res) {
    model.create(function(err, entity) {
      if (err) return handleRpcError(err, res);
      res.json({
        simulation: entity
      });

    })
  });

  router.get('/:id', function index(req, res) {
    model.read(req.params.id,
      function(err, entity, cursor) {
        if (err) return handleRpcError(err, res);
        res.json(entity);
      }
    );
  });

  return router;
};
