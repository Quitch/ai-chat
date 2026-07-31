define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var previousUnitCount = ko
    .observableArray()
    .extend({ session: "aic_previous_units" });

  var identifyNewlyInvadedPlanets = function (allyIndex, perPlanetUnitCounts) {
    if (_.isUndefined(previousUnitCount()[allyIndex])) {
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet

      previousUnitCount()[allyIndex] = _.range(0, planetCount, 0);
    }

    var newPlanets = [];

    perPlanetUnitCounts.forEach(function (planetUnitCount, planetIndex) {
      var armySizeMultiplier = 1.5;
      // avoid multiplying by zero
      var unitCount = Math.max(previousUnitCount()[allyIndex][planetIndex], 1);
      if (
        planetUnitCount > unitCount * armySizeMultiplier &&
        planetUnitCount > 20
      ) {
        newPlanets.push(planetIndex);
      }

      previousUnitCount()[allyIndex][planetIndex] = planetUnitCount;
      previousUnitCount.valueHasMutated();
    });

    return newPlanets;
  };

  var communicateAnyInvasions = function (ally, newlyInvadedPlanets) {
    newlyInvadedPlanets.forEach(function (planetIndex) {
      chat.send("team", ally.name, "invasion", planetIndex);
    });
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      var desiredUnits = [
        "bot",
        "tank",
        "orbital_",
        "land/bug_", // Bugs
      ];
      units
        .countDesired(aiAllyArmyIndex[allyIndex], desiredUnits)
        .then(function (perPlanetUnitCounts) {
          var newlyInvadedPlanets = identifyNewlyInvadedPlanets(
            allyIndex,
            perPlanetUnitCounts
          );

          // we don't check this first because identifyNewlyInvadedPlanets()
          // has to update the previous unit count
          var planetsPresentOn = 0;
          perPlanetUnitCounts.forEach(function (planetUnitCount) {
            if (planetUnitCount > 0) {
              planetsPresentOn++;
            }
          });
          if (planetsPresentOn < 2) {
            return;
          }

          communicateAnyInvasions(ally, newlyInvadedPlanets);
        });
    },
  };
});
