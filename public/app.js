angular.module('gaeTest', ['ngMaterial', 'ui.router', 'chart.js'])

  .config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/simulations');
    $stateProvider
      .state('view1', {
        url: "/simulations",
        templateUrl: "partials/simulations.html"
      })
      .state('view2', {
        url: "/simulations/:id",
        templateUrl: "partials/simulationResults.html",
        controller: 'SimulationCtrl'
      })
      .state('logs', {
        url: "/logs",
        templateUrl: "partials/logs.html"
      })
  })

  .factory('simulations', function($http) {
    var simulations = {};

    simulations.latest = [];
    simulations.fetchLatest = function() {
      $http.get('/simulation/', {latest: true})
        .success(function(data) {
          simulations.latest = data.simulations;
        });
    };
    simulations.start = function() {
      $http.post('/simulation/')
        .success(simulations.fetchLatest);
    };
    simulations.get = function(id) {
      return $http.get('/simulation/' + id);
    };
    return simulations;
  })

  .controller('AppCtrl', function ($scope, $timeout, $mdSidenav, $mdUtil, $log, $mdDialog, $location, simulations) {
    $scope.selectedIndex = 0;
    $scope.$watch('selectedIndex', function(current, old) {
      switch (current) {
        case 0:
          $location.url("/simulations");
          break;
        case 1:
          $location.url("/logs");
          break;
      }
    });

    $scope.toggleLeft = buildToggler('left');

    $scope.newSimulation = function(ev) {
      // Appending dialog to document.body to cover sidenav in docs app
      // Modal dialogs should fully cover application
      // to prevent interaction outside of dialog
      var confirm = $mdDialog.confirm()
        .title('Would you like to start a new simulation?')
        .content('It will run a batch of 100 tasks, each generating 1000 random numbers between 0 and 50.')
        .ariaLabel('New simulation')
        .ok('Yes')
        .cancel('No')
        .targetEvent(ev);
      $mdDialog.show(confirm).then(function() {
        simulations.start();
      });
    };

    $scope.showSimulationResults = function(simulation) {
      if (simulation.completed) {
        $scope.selectedIndex = undefined;
        $location.url('/simulations/' + simulation.id);
      }
    }

    $scope.showDashboard = function() {
      $scope.selectedIndex = 0;
      $location.url('/simulations/');
    }

    /**
     * Build handler to open/close a SideNav; when animation finishes
     * report completion in console
     */
    function buildToggler(navID) {
      var debounceFn =  $mdUtil.debounce(function(){
        $mdSidenav(navID)
          .toggle()
          .then(function () {
            $log.debug("toggle " + navID + " is done");
          });
      },300);

      return debounceFn;
    }

  })

  .controller('SimulationsCtrl', function($scope, $log, simulations) {
    $scope.simulations = simulations;
    $scope.checkIfCompleted = function(simulation) {
      simulation._checking = true;
      simulations.get(simulation.id)
        .success(function(s) {
          if (s.completed) {
            simulations.fetchLatest();
          }
          simulation._checking = false;
        });
    };
    simulations.fetchLatest();
  })

  .controller('SimulationCtrl', function($scope, $log, $stateParams, simulations) {
    simulations.get($stateParams.id)
      .success(function(simulation) {
        $scope.simulation = simulation;
        $scope.pieLabels = [];
        $scope.pieData = simulation.numbersCount.map(function(v, i) {
          $scope.pieLabels.push(i);
          return v / simulation.generatedNumbersCount * 100;
        })
      });
  })

  .controller('ActivitiesCtrl', function($scope) {
    $scope.activities = getActivities();

    function getActivities() {
      return [
        {
          date: new Date(),
          description: "todo"
        },
        {
          date: new Date(),
          description: "todo"
        },
        {
          date: new Date(),
          description: "todo"
        },
        {
          date: new Date(),
          description: "todo"
        },
        {
          date: new Date(),
          description: "todo"
        }
      ].sort(function(a, b) {
          return a.date < b.date;
        })
    }
  })

;
