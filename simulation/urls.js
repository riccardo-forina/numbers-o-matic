"use strict";

var express = require('express');

module.exports = function(simulation, action, oauth2) {
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

  router.get('/', function index(req, res) {
    res.set('Content-Type', 'text/html');
    res.render('simulation/index.jade');
  });

  router.get('/simulation', function index(req, res) {
    res.set('Content-Type', 'application/json');
    simulation.list(100, req.query.pageToken, '-date',
      function(err, entities, cursor) {
        if (err) return handleRpcError(err, res);
        res.json({
          simulations: entities,
          nextPageToken: cursor
        });
      }
    );
  });

  router.post('/simulation', function startSimulation(req, res) {
    res.set('Content-Type', 'application/json');
    simulation.create(req.session.profile.displayName, function(err, entity) {
      if (err) return handleRpcError(err, res);
      res.json({
        simulation: entity
      });
      action.create(req.session.profile.displayName, 'Started new simulation ' + entity.key.path[entity.key.path.length - 1]);
    })
  });

  router.get('/simulation/:id', function index(req, res) {
    res.set('Content-Type', 'application/json');
    simulation.read(req.params.id,
      function(err, entity, cursor) {
        if (err) return handleRpcError(err, res);
        res.json(entity);
      }
    );
  });

  router.get('/actions', function index(req, res) {
    res.set('Content-Type', 'application/json');
    action.list(100, req.query.pageToken, '-date',
      function(err, entities, cursor) {
        if (err) return handleRpcError(err, res);
        res.json({
          actions: entities,
          nextPageToken: cursor
        });
      }
    );
  });

  return router;
};
