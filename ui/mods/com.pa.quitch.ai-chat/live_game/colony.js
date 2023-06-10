define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var currentlyColonisedPlanets = ko
    .observableArray()
    .extend({ session: "ai_chat_colonised_planets" });

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
    // remove planets which are no longer reported as colonised - this allows for future messages
    currentlyColonisedPlanets()[allyIndex] = _.intersection(
      currentlyColonisedPlanets()[allyIndex],
      matchedPlanets
    ).concat(excludedPlanets);

    var newPlanets = _.filter(matchedPlanets, function (matchedPlanet) {
      return !_.includes(currentlyColonisedPlanets()[allyIndex], matchedPlanet);
    });

    sendColonisedMessage(ally, newPlanets);

    currentlyColonisedPlanets()[allyIndex] =
      currentlyColonisedPlanets()[allyIndex].concat(newPlanets);
    currentlyColonisedPlanets.valueHasMutated();
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      var desiredUnits = [
        "lander",
        "teleporter",
        "fabrication",
        "mining_platform",
        "commander",
      ];
      var desiredUnitCount = 2; // we only need a fabber and something else
      var excludedUnits = ["factory"];
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount,
          excludedUnits
        )
        .then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];
          var excludedPlanets = planetsWithUnit[1];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          if (_.isUndefined(currentlyColonisedPlanets()[allyIndex])) {
            currentlyColonisedPlanets()[allyIndex] = [];
          }

          checkForPlanetsWeLost(
            ally,
            currentlyColonisedPlanets()[allyIndex],
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
