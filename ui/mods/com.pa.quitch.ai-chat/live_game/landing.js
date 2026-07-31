define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  return {
    location: function (aiAllyArmyIndex, aiAllies) {
      aiAllies.forEach(function (ally, i) {
        units
          .checkForDesired(
            aiAllyArmyIndex[i],
            ally.commanders,
            ally.commanders.length
          )
          .then(function (planetsWithUnit) {
            var matchedPlanets = planetsWithUnit[0];

            if (_.isEmpty(matchedPlanets)) {
              return;
            }

            matchedPlanets.forEach(function (planetIndex) {
              chat.send("team", ally.name, "landing", planetIndex);
            });
          });
      });
    },
  };
});
