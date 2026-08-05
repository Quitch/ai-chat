define(function () {
  var lookupLifetime = 5000;
  var lookups = {};

  var dropExpiredLookups = function (now) {
    for (var key in lookups) {
      if (now - lookups[key].fetched >= lookupLifetime) {
        delete lookups[key];
      }
    }
  };

  var getArmyUnits = function (armyIndex, planetIndex) {
    var key = armyIndex + ":" + planetIndex;
    var now = Date.now();
    var lookup = lookups[key];

    if (lookup && now - lookup.fetched < lookupLifetime) {
      return lookup.units;
    }

    dropExpiredLookups(now);
    lookups[key] = {
      fetched: now,
      units: api.getWorldView().getArmyUnits(armyIndex, planetIndex),
    };
    return lookups[key].units;
  };

  var planetCount = function () {
    // the last entry in the planet list is not a planet, and planets can be
    // destroyed mid-game, so this is read per call rather than cached
    return model.planetListState().planets.length - 1;
  };

  var countAllUnits = function (unitsOnPlanet) {
    var unitCount = 0;
    for (var unit in unitsOnPlanet) {
      unitCount += unitsOnPlanet[unit].length;
    }
    return unitCount;
  };

  var isExcludedUnit = function (unit, excludedUnits) {
    if (!excludedUnits) {
      return false;
    }

    for (var excludedUnit of excludedUnits) {
      if (_.includes(unit, excludedUnit)) {
        return true;
      }
    }
    return false;
  };

  var countDesiredUnits = function (
    unitsOnPlanet,
    desiredUnits,
    excludedUnits
  ) {
    var desiredUnitsCount = 0;
    for (var unit in unitsOnPlanet) {
      if (isExcludedUnit(unit, excludedUnits)) {
        continue;
      }

      for (var desiredUnit of desiredUnits) {
        if (_.includes(unit, desiredUnit)) {
          desiredUnitsCount += unitsOnPlanet[unit].length;
          break;
        }
      }
    }
    return desiredUnitsCount;
  };

  var matchesAnyUnit = function (unit, desiredUnits) {
    for (var element of desiredUnits) {
      if (_.includes(unit, element)) {
        return true;
      }
    }
    return false;
  };

  var isNewDesiredUnit = function (unit, desiredUnits, seenDesiredUnit) {
    for (var i = 0; i < desiredUnits.length; i++) {
      if (_.includes(unit, desiredUnits[i])) {
        if (seenDesiredUnit[i]) {
          return false;
        }
        seenDesiredUnit[i] = true;
        return true;
      }
    }
    return false;
  };

  // an excluded unit rejects the whole planet, an ignored unit only fails to
  // count towards a match - what a unit that merely shares a name fragment with
  // the desired units needs
  var matchPlanet = function (
    unitsOnPlanet,
    desiredUnits,
    desiredUnitCount,
    excludedUnits,
    ignoredUnits
  ) {
    var seenDesiredUnit = [];
    var matches = 0;

    for (var unit in unitsOnPlanet) {
      if (isExcludedUnit(unit, excludedUnits)) {
        return { excluded: true, matches: 0 };
      }

      if (isExcludedUnit(unit, ignoredUnits)) {
        continue;
      }

      if (matches >= desiredUnitCount) {
        if (excludedUnits) {
          continue;
        }
        break;
      }

      if (isNewDesiredUnit(unit, desiredUnits, seenDesiredUnit)) {
        matches++;
      }
    }

    return { excluded: false, matches: matches };
  };

  var checkForDesiredSets = function (aiIndex, sets) {
    var pendingLookups = [];
    var results = sets.map(function (set) {
      return {
        desiredUnits: _.isArray(set.desiredUnits)
          ? set.desiredUnits
          : [set.desiredUnits],
        desiredUnitCount: set.desiredUnitCount,
        excludedUnits: set.excludedUnits,
        ignoredUnits: set.ignoredUnits,
        matches: [],
        rejections: [],
      };
    });

    _.times(planetCount(), function (planetIndex) {
      pendingLookups.push(
        getArmyUnits(aiIndex, planetIndex).then(function (unitsOnPlanet) {
          results.forEach(function (result) {
            var planet = matchPlanet(
              unitsOnPlanet,
              result.desiredUnits,
              result.desiredUnitCount,
              result.excludedUnits,
              result.ignoredUnits
            );

            if (planet.excluded) {
              result.rejections.push(planetIndex);
            } else if (planet.matches >= result.desiredUnitCount) {
              result.matches.push(planetIndex);
            }
          });
        })
      );
    });

    return Promise.all(pendingLookups).then(function () {
      return results.map(function (result) {
        return [result.matches, result.rejections];
      });
    });
  };

  return {
    countAll: function (aisIndex) {
      var pendingLookups = [];
      var unitCount = [];

      _.times(planetCount(), function (planetIndex) {
        aisIndex.forEach(function (aiIndex, armyPosition) {
          pendingLookups.push(
            getArmyUnits(aiIndex, planetIndex).then(function (unitsOnPlanet) {
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

      return Promise.all(pendingLookups).then(function () {
        return unitCount;
      });
    },
    countDesired: function (aiIndex, desiredUnits, excludedUnits) {
      var pendingLookups = [];
      var desiredUnitCount = [];

      _.times(planetCount(), function (planetIndex) {
        pendingLookups.push(
          getArmyUnits(aiIndex, planetIndex).then(function (unitsOnPlanet) {
            var desiredUnitsOnPlanet = countDesiredUnits(
              unitsOnPlanet,
              desiredUnits,
              excludedUnits
            );
            // assign rather than push - these resolve out of order
            desiredUnitCount[planetIndex] = desiredUnitsOnPlanet;
          })
        );
      });

      return Promise.all(pendingLookups).then(function () {
        return desiredUnitCount;
      });
    },
    findUnits: function (aiIndex, desiredUnits) {
      var pendingLookups = [];
      var found = [];

      if (!_.isArray(desiredUnits)) {
        desiredUnits = [desiredUnits];
      }

      _.times(planetCount(), function (planetIndex) {
        pendingLookups.push(
          getArmyUnits(aiIndex, planetIndex).then(function (unitsOnPlanet) {
            for (var unit in unitsOnPlanet) {
              if (matchesAnyUnit(unit, desiredUnits)) {
                found = found.concat(unitsOnPlanet[unit]);
              }
            }
          })
        );
      });

      return Promise.all(pendingLookups).then(function () {
        return found;
      });
    },
    checkForDesiredSets: checkForDesiredSets,
    checkForDesired: function (
      aiIndex,
      desiredUnits,
      desiredUnitCount,
      excludedUnits,
      ignoredUnits
    ) {
      return checkForDesiredSets(aiIndex, [
        {
          desiredUnits: desiredUnits,
          desiredUnitCount: desiredUnitCount,
          excludedUnits: excludedUnits,
          ignoredUnits: ignoredUnits,
        },
      ]).then(function (results) {
        return results[0];
      });
    },
  };
});
