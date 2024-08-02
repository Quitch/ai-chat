define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  const colonisedPlanets = ko
    .observableArray()
    .extend({ session: "aic_colonised_planets" });

  const sendLostPlanetMessage = function (ally, lostPlanets) {
    lostPlanets.forEach(function (planetIndex) {
      chat.send("team", ally.name, "planetLost", planetIndex);
    });
  };

  const checkForPlanetsWeLost = function (
    ally,
    ourPastPlanets,
    matchedPlanets,
    excludedPlanets
  ) {
    const ourCurrentPlanets = matchedPlanets.concat(excludedPlanets);
    const lostPlanets = _.filter(ourPastPlanets, function (planet) {
      return !_.includes(ourCurrentPlanets, planet);
    });

    if (_.isEmpty(lostPlanets)) {
      return;
    }

    sendLostPlanetMessage(ally, lostPlanets);
  };

  const sendColonisedMessage = function (ally, newPlanets) {
    newPlanets.forEach(function (planetIndex) {
      chat.send("team", ally.name, "colonise", planetIndex);
    });
  };

  const checkForPlanetsWeColonised = function (
    ally,
    allyIndex,
    matchedPlanets,
    excludedPlanets
  ) {
    // remove planets which are no longer reported as colonised - this allows for future messages
    colonisedPlanets()[allyIndex] = _.intersection(
      colonisedPlanets()[allyIndex],
      matchedPlanets
    ).concat(excludedPlanets);

    const newPlanets = _.filter(matchedPlanets, function (matchedPlanet) {
      return !_.includes(colonisedPlanets()[allyIndex], matchedPlanet);
    });

    sendColonisedMessage(ally, newPlanets);

    colonisedPlanets()[allyIndex] =
      colonisedPlanets()[allyIndex].concat(newPlanets);
    colonisedPlanets.valueHasMutated();
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      const desiredUnits = [
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
      const desiredUnitCount = 2; // we only need a fabber and something else
      const excludedUnits = [
        "factory",
        "_hive", //Bugs
      ];
      units
        .checkForDesired(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount,
          excludedUnits
        )
        .then(function (planetsWithUnit) {
          const matchedPlanets = planetsWithUnit[0];
          const excludedPlanets = planetsWithUnit[1];

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
