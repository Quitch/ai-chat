// SPIKE-1: temporary diagnostic. This file is reverted once its findings are
// recorded - it must never reach a release.
//
// Answers two questions we cannot answer by reading code:
//   1. Does getArmyUnits() with planetIndex omitted (it defaults to -1) really
//      return every planet, and is the result flat or nested per planet?
//   2. What fields does getUnitState() actually return? Only "planet" is
//      confirmed by the base game.
define(function () {
  var log = function (message) {
    console.log("AIC PROBE: " + message);
  };

  var planetCount = function () {
    return model.planetListState().planets.length - 1; // last is not a planet
  };

  var countUnits = function (armyUnits) {
    var total = 0;
    for (var spec in armyUnits) {
      if (_.isArray(armyUnits[spec])) {
        total += armyUnits[spec].length;
      }
    }
    return total;
  };

  var describeShape = function (armyUnits) {
    var keys = Object.keys(armyUnits);
    var firstValue = armyUnits[keys[0]];
    return {
      keyCount: keys.length,
      firstKey: keys[0],
      firstValueIsArray: _.isArray(firstValue),
      firstValueType: typeof firstValue,
      firstValueSample: JSON.stringify(firstValue).slice(0, 200),
    };
  };

  // Question 1: compare the omitted-argument call against the sum of the
  // per-planet calls we make today. Equal totals mean -1 is "all planets".
  var probeAllPlanetsCall = function (armyIndex) {
    api
      .getWorldView()
      .getArmyUnits(armyIndex)
      .then(function (omittedArg) {
        log("--- getArmyUnits(" + armyIndex + ") with planetIndex omitted ---");
        log("shape " + JSON.stringify(describeShape(omittedArg)));
        log("unit total " + countUnits(omittedArg));
        log("keys " + JSON.stringify(Object.keys(omittedArg)).slice(0, 1500));

        var perPlanetCalls = [];
        for (var i = 0; i < planetCount(); i++) {
          perPlanetCalls.push(api.getWorldView().getArmyUnits(armyIndex, i));
        }

        Promise.all(perPlanetCalls).then(function (perPlanetResults) {
          var total = 0;
          perPlanetResults.forEach(function (result, planetIndex) {
            var onThisPlanet = countUnits(result);
            total += onThisPlanet;
            log("planet " + planetIndex + " has " + onThisPlanet + " units");
          });
          log(
            "per-planet total " +
              total +
              " vs omitted-arg total " +
              countUnits(omittedArg) +
              " -> " +
              (total === countUnits(omittedArg) ? "MATCH" : "MISMATCH")
          );
        });
      });
  };

  // Question 2: dump a whole unit state object. Uses explicit per-planet calls
  // so it does not depend on the answer to question 1.
  var probeUnitState = function (armyIndex, commanders) {
    var perPlanetCalls = [];
    for (var i = 0; i < planetCount(); i++) {
      perPlanetCalls.push(api.getWorldView().getArmyUnits(armyIndex, i));
    }

    Promise.all(perPlanetCalls).then(function (perPlanetResults) {
      var unitId;
      perPlanetResults.forEach(function (armyUnits) {
        for (var spec in armyUnits) {
          var isCommander = _.some(commanders, function (commander) {
            return _.includes(spec, commander);
          });
          if (isCommander && !_.isEmpty(armyUnits[spec])) {
            unitId = armyUnits[spec][0];
          }
        }
      });

      if (_.isUndefined(unitId)) {
        log("no commander found for army " + armyIndex + ", skipping");
        return;
      }

      api
        .getWorldView()
        .getUnitState(unitId)
        .then(function (state) {
          log("--- getUnitState(" + unitId + ") ---");
          log("keys " + JSON.stringify(Object.keys(state)));
          log("full " + JSON.stringify(state));
        });
    });
  };

  return {
    run: function (aiAllyArmyIndex, aiAllies) {
      if (_.isEmpty(aiAllyArmyIndex)) {
        log("no AI allies, nothing to probe");
        return;
      }

      var armyIndex = aiAllyArmyIndex[0];
      var commanders = aiAllies[0].commanders;
      log(
        "probing army " + armyIndex + " across " + planetCount() + " planets"
      );
      probeAllPlanetsCall(armyIndex);
      probeUnitState(armyIndex, commanders);
    },
  };
});
