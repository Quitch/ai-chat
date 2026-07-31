define(function () {
  // the colony, invasion and tech checks all ask about the same ally, and the
  // situation report asks about that ally again, so within a tick the same
  // army and planet is fetched several times over. The in-flight promise is
  // what gets cached, not just the result, so callers that overlap share one
  // round trip rather than only ones that follow it.
  //
  // The lifetime is comfortably shorter than the ~10s check interval, so an
  // entry never spans two ticks and no check ever sees data from the tick
  // before its own
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

    // nothing mutates a unit map, so handing the same one to several callers
    // is safe
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
          break; // a unit path can contain more than one desired unit
        }
      }
    }
    return desiredUnitsCount;
  };

  var matchesAnyUnit = function (unit, desiredUnits) {
    for (var i = 0; i < desiredUnits.length; i++) {
      if (_.includes(unit, desiredUnits[i])) {
        return true;
      }
    }
    return false;
  };

  // a unit path can contain more than one desired unit, so match on the unit
  // rather than the desired unit to stop one unit counting twice. seenDesiredUnit
  // is indexed by desired unit, making the seen test a lookup rather than a scan
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

  // a single excluded unit rejects the whole planet, so exclusions and desired
  // units are resolved in one pass rather than two
  var matchPlanet = function (
    unitsOnPlanet,
    desiredUnits,
    desiredUnitCount,
    excludedUnits
  ) {
    var seenDesiredUnit = [];
    var matches = 0;

    for (var unit in unitsOnPlanet) {
      if (isExcludedUnit(unit, excludedUnits)) {
        return { excluded: true, matches: 0 };
      }

      if (matches >= desiredUnitCount) {
        if (excludedUnits) {
          continue; // an excluded unit could still reject the planet
        }
        break; // nothing left that could change the answer
      }

      if (isNewDesiredUnit(unit, desiredUnits, seenDesiredUnit)) {
        matches++;
      }
    }

    return { excluded: false, matches: matches };
  };

  // several sets of desired units resolved against one pass over the planets,
  // so callers looking for more than one thing about the same army do not each
  // pay for their own lookup. Each set is
  // {desiredUnits, desiredUnitCount, excludedUnits}, and the results come back
  // in the order the sets were given
  var checkForDesiredSets = function (aiIndex, sets) {
    var pendingLookups = [];
    var results = sets.map(function (set) {
      return {
        desiredUnits: _.isArray(set.desiredUnits)
          ? set.desiredUnits
          : [set.desiredUnits],
        desiredUnitCount: set.desiredUnitCount,
        excludedUnits: set.excludedUnits,
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
              result.excludedUnits
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
    // the ids of matching units rather than a count of them, for the callers
    // that need to ask getUnitState about a specific unit
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
      excludedUnits
    ) {
      return checkForDesiredSets(aiIndex, [
        {
          desiredUnits: desiredUnits,
          desiredUnitCount: desiredUnitCount,
          excludedUnits: excludedUnits,
        },
      ]).then(function (results) {
        return results[0];
      });
    },
  };
});
