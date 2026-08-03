define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var colonisedPlanets = ko
    .observableArray()
    .extend({ session: "aic_colonised_planets" });

  var sendLostPlanetMessage = function (ally, lostPlanets) {
    lostPlanets.forEach(function (planetIndex) {
      chat.send("team", ally.name, "planetLost", planetIndex);
    });
  };

  var checkForPlanetsWeLost = function (
    ally,
    ourPastPlanets,
    matchedPlanets,
    excludedPlanets
  ) {
    var ourCurrentPlanets = matchedPlanets.concat(excludedPlanets);
    var lostPlanets = _.filter(ourPastPlanets, function (planet) {
      return !_.includes(ourCurrentPlanets, planet);
    });

    if (_.isEmpty(lostPlanets)) {
      return;
    }

    sendLostPlanetMessage(ally, lostPlanets);
  };

  var sendColonisedMessage = function (ally, newPlanets) {
    newPlanets.forEach(function (planetIndex) {
      chat.send("team", ally.name, "colonise", planetIndex);
    });
  };

  var checkForPlanetsWeColonised = function (
    ally,
    allyIndex,
    matchedPlanets,
    excludedPlanets
  ) {
    colonisedPlanets()[allyIndex] = _.intersection(
      colonisedPlanets()[allyIndex],
      matchedPlanets
    ).concat(excludedPlanets);

    var newPlanets = _.filter(matchedPlanets, function (matchedPlanet) {
      return !_.includes(colonisedPlanets()[allyIndex], matchedPlanet);
    });

    sendColonisedMessage(ally, newPlanets);

    colonisedPlanets()[allyIndex] =
      colonisedPlanets()[allyIndex].concat(newPlanets);
    colonisedPlanets.valueHasMutated();
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      var desiredUnits = [
        "lander",
        "teleporter",
        "fabrication",
        "mining_platform",
        "commander",
        // Bugs
        "bug_jig",
        "fabricator",
        "_fab",
      ];
      var desiredUnitCount = 2; // we only need a fabber and something else
      var excludedUnits = [
        "factory",
        // Bugs - naming every factory a hive, but not every hive is one
        "advanced_hive",
        "basic_hive",
        "bug_swarm_hive", // anchored so it cannot match Legion's l_swarm_hive turret
        "air_hive",
        "naval_hive",
        "bug_gas_hive", // their orbital factory, despite the name
        // Exiles - only their Fabber Foundry is named a factory, and each of
        // these also covers the _adv form
        "t_air_fac",
        "t_bot_fac",
        "t_naval_fac",
        "t_tank_fac",
      ];
      // Exiles' Puma is a factory built bot that lives in the commanders
      // directory, so it must not stand in for a commander
      var ignoredUnits = ["ft_commander"];
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount,
          excludedUnits,
          ignoredUnits
        )
        .then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];
          var excludedPlanets = planetsWithUnit[1];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          if (_.isUndefined(colonisedPlanets()[allyIndex])) {
            colonisedPlanets()[allyIndex] = [];
          }

          checkForPlanetsWeLost(
            ally,
            colonisedPlanets()[allyIndex],
            matchedPlanets,
            excludedPlanets
          );
          checkForPlanetsWeColonised(
            ally,
            allyIndex,
            matchedPlanets,
            excludedPlanets
          );
        });
    },
  };
});
