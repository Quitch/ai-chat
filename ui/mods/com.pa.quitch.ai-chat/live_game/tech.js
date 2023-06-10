define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var that = this;
  var alliedT2TechReported = ko
    .observableArray()
    .extend({ session: "ai_chat_ally_t2_check" });
  var alliedOrbitalTechReported = ko
    .observableArray()
    .extend({ session: "ai_chat_ally_orbital_check" });

  return {
    alliedT2CheckInterval: [],
    alliedT2Check: function (aiAllyArmyIndex, ally, allyIndex) {
      var desiredUnits = ["_adv"];
      var desiredUnitCount = 1;
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        )
        .then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          clearInterval(that.alliedT2TechCheckInterval[allyIndex]);

          if (alliedT2TechReported()[allyIndex] === true) {
            return;
          }

          chat.send("team", ally.name, "allyAdvTech");
          alliedT2TechReported()[allyIndex] = true;
          alliedT2TechReported.valueHasMutated();
        });
    },
    alliedOrbitalCheckInterval: [],
    alliedOrbitalCheck: function (aiAllyArmyIndex, ally, allyIndex) {
      var desiredUnits = ["orbital_"];
      var desiredUnitCount = 1;
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        )
        .then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          clearInterval(that.alliedOrbitalTechCheckInterval[allyIndex]);

          if (alliedOrbitalTechReported()[allyIndex] === true) {
            return;
          }

          chat.send("team", ally.name, "allyOrbitalTech");
          alliedOrbitalTechReported()[allyIndex] = true;
          alliedOrbitalTechReported.valueHasMutated();
        });
    },
  };
});
