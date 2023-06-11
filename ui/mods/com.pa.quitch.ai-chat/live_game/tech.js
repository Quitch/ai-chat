define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  var alliedT2TechReported = observableArray("aic_ally_t2_check");
  var alliedOrbitalReported = observableArray("aic_ally_orbital_check");

  var reportTechStatus = function (
    ally,
    allyIndex,
    interval,
    planetsWithUnit,
    reported,
    message
  ) {
    var matchedPlanets = planetsWithUnit[0];

    if (_.isEmpty(matchedPlanets)) {
      return;
    }

    clearInterval(interval[allyIndex]);

    if (reported()[allyIndex] === true) {
      return;
    }

    chat.send("team", ally.name, message);
    reported()[allyIndex] = true;
    reported.valueHasMutated();
  };

  return {
    alliedT2Check: function (aiAllyArmyIndex, ally, allyIndex, interval) {
      var desiredUnits = ["_adv"];
      var desiredUnitCount = 1;
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        )
        .then(function (planetsWithUnit) {
          reportTechStatus(
            ally,
            allyIndex,
            interval,
            planetsWithUnit,
            alliedT2TechReported,
            "allyAdvTech"
          );
        });
    },
    alliedOrbitalCheck: function (aiAllyArmyIndex, ally, allyIndex, interval) {
      var desiredUnits = ["orbital_"];
      var desiredUnitCount = 1;
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        )
        .then(function (planetsWithUnit) {
          reportTechStatus(
            ally,
            allyIndex,
            interval,
            planetsWithUnit,
            alliedOrbitalReported,
            "allyOrbitalTech"
          );
        });
    },
  };
});
