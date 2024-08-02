define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  const observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  const alliedT2TechReported = observableArray("aic_ally_t2_check");
  const alliedOrbitalReported = observableArray("aic_ally_orbital_check");

  const reportTechStatus = function (
    ally,
    allyIndex,
    interval,
    planetsWithUnit,
    reported,
    message
  ) {
    const matchedPlanets = planetsWithUnit[0];

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
      const desiredUnits = [
        "_adv",
        "advanced", // Bugs
      ];
      const desiredUnitCount = 1;
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
      const desiredUnits = ["orbital_"];
      const desiredUnitCount = 1;
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
