define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var attemptLimit = 10;
  // longer than the unit lookup cache lifetime, or a retry is answered from
  // the same cached result that just came back empty
  var retryDelay = 6000;

  var reportLanding = function (aiAllyArmyIndex, ally, allyIndex, attempt) {
    var desiredUnitCount = 1; // a shared army's commanders can land apart

    units
      .checkForDesired(
        aiAllyArmyIndex[allyIndex],
        ally.commanders,
        desiredUnitCount
      )
      .then(function (planetsWithUnit) {
        var matchedPlanets = planetsWithUnit[0];

        if (_.isEmpty(matchedPlanets)) {
          if (attempt < attemptLimit) {
            _.delay(
              reportLanding,
              retryDelay,
              aiAllyArmyIndex,
              ally,
              allyIndex,
              attempt + 1
            );
          }
          return;
        }

        matchedPlanets.forEach(function (planetIndex) {
          chat.send("team", ally.name, "landing", planetIndex);
        });
      });
  };

  return {
    location: function (aiAllyArmyIndex, aiAllies) {
      aiAllies.forEach(function (ally, i) {
        reportLanding(aiAllyArmyIndex, ally, i, 1);
      });
    },
  };
});
