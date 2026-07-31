define(function () {
  var countAllUnits = function (unitsOnPlanet) {
    var unitCount = 0;
    for (var unit in unitsOnPlanet) {
      unitCount += unitsOnPlanet[unit].length;
    }
    return unitCount;
  };

  var countDesiredUnits = function (unitsOnPlanet, desiredUnits) {
    var desiredUnitsCount = 0;
    desiredUnits.forEach(function (desiredUnit) {
      for (var unit in unitsOnPlanet) {
        if (_.includes(unit, desiredUnit)) {
          desiredUnitsCount += unitsOnPlanet[unit].length;
        }
      }
    });
    return desiredUnitsCount;
  };

  var checkForExcludedUnits = function (unitsOnPlanet, excludedUnits) {
    if (!excludedUnits) {
      return false;
    }

    for (var excludedUnit of excludedUnits) {
      for (var unit in unitsOnPlanet) {
        var excludedUnitPresent = _.includes(unit, excludedUnit);
        if (excludedUnitPresent) {
          return true;
        }
      }
    }
    return false;
  };

  var checkForDesiredUnits = function (unitsOnPlanet, desiredUnits) {
    if (!_.isArray(desiredUnits)) {
      desiredUnits = [desiredUnits];
    }

    // a unit path can contain more than one desired unit, so match on the
    // unit rather than the desired unit to stop one unit counting twice
    var matchedDesiredUnits = [];
    for (var unit in unitsOnPlanet) {
      for (var i = 0; i < desiredUnits.length; i++) {
        if (_.includes(unit, desiredUnits[i])) {
          if (!_.includes(matchedDesiredUnits, i)) {
            matchedDesiredUnits.push(i);
          }
          break;
        }
      }
    }
    return matchedDesiredUnits.length;
  };

  return {
    countAll: function (aisIndex) {
      var deferred = $.Deferred();
      var deferredQueue = [];
      var unitCount = [];
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet

      _.times(planetCount, function (planetIndex) {
        aisIndex.forEach(function (aiIndex, armyPosition) {
          deferredQueue.push(
            api
              .getWorldView()
              .getArmyUnits(aiIndex, planetIndex)
              .then(function (unitsOnPlanet) {
                var unitCountOnPlanet = countAllUnits(unitsOnPlanet);
                if (_.isUndefined(unitCount[planetIndex])) {
                  unitCount[planetIndex] = [];
                }
                // assign rather than push - these resolve out of order
                unitCount[planetIndex][armyPosition] = unitCountOnPlanet;
              })
          );
        });
      });

      Promise.all(deferredQueue).then(function () {
        deferred.resolve(unitCount);
      });

      return deferred.promise();
    },
    countDesired: function (aiIndex, desiredUnits) {
      var deferred = $.Deferred();
      var deferredQueue = [];
      var desiredUnitCount = [];
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet

      _.times(planetCount, function (planetIndex) {
        deferredQueue.push(
          api
            .getWorldView()
            .getArmyUnits(aiIndex, planetIndex)
            .then(function (unitsOnPlanet) {
              var desiredUnitsOnPlanet = countDesiredUnits(
                unitsOnPlanet,
                desiredUnits
              );
              // assign rather than push - these resolve out of order
              desiredUnitCount[planetIndex] = desiredUnitsOnPlanet;
            })
        );
      });

      Promise.all(deferredQueue).then(function () {
        deferred.resolve(desiredUnitCount);
      });

      return deferred.promise();
    },
    checkForDesired: function (
      aiIndex,
      desiredUnits,
      desiredUnitCount,
      excludedUnits
    ) {
      var deferred = $.Deferred();
      var deferredQueue = [];
      var matches = [];
      var rejections = [];
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet

      _.times(planetCount, function (planetIndex) {
        deferredQueue.push(
          api
            .getWorldView()
            .getArmyUnits(aiIndex, planetIndex)
            .then(function (unitsOnPlanet) {
              var excludedUnitsOnPlanet = checkForExcludedUnits(
                unitsOnPlanet,
                excludedUnits
              );

              if (excludedUnitsOnPlanet) {
                rejections.push(planetIndex);
                return;
              }

              var desiredUnitsOnPlanet = checkForDesiredUnits(
                unitsOnPlanet,
                desiredUnits
              );

              if (desiredUnitsOnPlanet >= desiredUnitCount) {
                matches.push(planetIndex);
              }
            })
        );
      });

      Promise.all(deferredQueue).then(function () {
        deferred.resolve([matches, rejections]);
      });

      return deferred.promise();
    },
  };
});
