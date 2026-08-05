define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var commanderPlanets = ko
    .observableArray()
    .extend({ session: "aic_commander_planet" });

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
      // shared army commander tracking
      units
        .findUnitPlanets(aiAllyArmyIndex[allyIndex], ally.commanders)
        .then(function (currentPlanets) {
          if (_.isEmpty(currentPlanets)) {
            return;
          }

          reportArrivals(ally, allyIndex, currentPlanets);
        });
    },
  };
});
