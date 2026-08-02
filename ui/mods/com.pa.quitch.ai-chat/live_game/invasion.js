define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var previousUnitCount = ko
    .observableArray()
    .extend({ session: "aic_previous_units" });

  var armySizeMultiplier = 1.5; // a force this much bigger has just arrived
  var collapseMultiplier = 0.4; // most of the force that was here is gone
  var significantForce = 20;

  var identifyArmyChanges = function (allyIndex, perPlanetUnitCounts) {
    if (_.isUndefined(previousUnitCount()[allyIndex])) {
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet

      previousUnitCount()[allyIndex] = _.range(0, planetCount, 0);
    }

    var invaded = [];
    var collapsed = [];

    perPlanetUnitCounts.forEach(function (planetUnitCount, planetIndex) {
      var previousUnits = previousUnitCount()[allyIndex][planetIndex];
      var unitCount = Math.max(previousUnits, 1); // avoid multiplying by zero

      if (
        planetUnitCount > unitCount * armySizeMultiplier &&
        planetUnitCount > significantForce
      ) {
        invaded.push(planetIndex);
      } else if (
        previousUnits > significantForce &&
        planetUnitCount > 0 && // losing the planet outright is colony.js's to report
        planetUnitCount < previousUnits * collapseMultiplier
      ) {
        collapsed.push(planetIndex);
      }

      previousUnitCount()[allyIndex][planetIndex] = planetUnitCount;
      previousUnitCount.valueHasMutated();
    });

    return { invaded: invaded, collapsed: collapsed };
  };

  var communicate = function (ally, planets, message) {
    planets.forEach(function (planetIndex) {
      chat.send("team", ally.name, message, planetIndex);
    });
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      // mobile land and orbital units - air and naval do not take a planet,
      // and a structure is not part of the force that arrived
      var desiredUnits = [
        "bot",
        "tank",
        "vehicle",
        "orbital_",
        "titan_orbital", // the only titan named the other way around
        "land_scout",
        "land/bug_", // Bugs
        "necromancer", // Legion, and the Purgers it spawns
      ];
      var excludedUnits = [
        "fabrication",
        "factory",
        "sea_", // Legion names a ship l_sea_tank
        "spawner",
        "_fab", // Bugs
      ];
      units
        .countDesired(aiAllyArmyIndex[allyIndex], desiredUnits, excludedUnits)
        .then(function (perPlanetUnitCounts) {
          var changes = identifyArmyChanges(allyIndex, perPlanetUnitCounts);

          communicate(ally, changes.collapsed, "armyCollapse");

          // dependent on identifyArmyChanges() updating the previous unit count
          var planetsPresentOn = 0;
          perPlanetUnitCounts.forEach(function (planetUnitCount) {
            if (planetUnitCount > 0) {
              planetsPresentOn++;
            }
          });
          if (planetsPresentOn < 2) {
            return;
          }

          communicate(ally, changes.invaded, "invasion");
        });
    },
  };
});
