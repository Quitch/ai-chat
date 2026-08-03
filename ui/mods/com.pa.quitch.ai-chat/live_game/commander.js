define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var commanderPlanets = ko
    .observableArray()
    .extend({ session: "aic_commander_planet" });

  var planetsOccupied = function (states) {
    var planets = [];

    states.forEach(function (state) {
      if (state && !_.includes(planets, state.planet)) {
        planets.push(state.planet);
      }
    });

    return planets;
  };

  var reportArrivals = function (ally, allyIndex, currentPlanets) {
    var previousPlanets = commanderPlanets()[allyIndex];

    if (!_.isUndefined(previousPlanets)) {
      currentPlanets.forEach(function (planetIndex) {
        if (!_.includes(previousPlanets, planetIndex)) {
          chat.send("team", ally.name, "commanderMoved", planetIndex);
        }
      });
    }

    commanderPlanets()[allyIndex] = currentPlanets;
    commanderPlanets.valueHasMutated();
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      units
        .findUnits(aiAllyArmyIndex[allyIndex], ally.commanders)
        .then(function (commanderIds) {
          if (_.isEmpty(commanderIds)) {
            return;
          }

          // shared army commander tracking
          api
            .getWorldView()
            .getUnitState(commanderIds)
            .then(function (states) {
              reportArrivals(ally, allyIndex, planetsOccupied(states));
            });
        });
    },
  };
});
