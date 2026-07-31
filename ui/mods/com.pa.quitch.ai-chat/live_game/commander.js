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

    // the first sighting is where the commander landed, which the landing
    // announcement has already covered
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
    // an ally moving its commander to another planet is a commitment the
    // player will want to know about, and nothing else in the mod reports it
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      units
        .findUnits(aiAllyArmyIndex[allyIndex], ally.commanders)
        .then(function (commanderIds) {
          if (_.isEmpty(commanderIds)) {
            return;
          }

          // a shared army can have several commanders on different planets,
          // so this tracks the set rather than a single location
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
