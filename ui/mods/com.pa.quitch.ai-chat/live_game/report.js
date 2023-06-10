define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var separateFriendFromFoe = function (planetUnitCounts, aiAllyArmyIndex) {
    var alliedUnitsPerPlanet = [];
    var enemyUnitsPerPlanet = [];
    var playerIndex = _.findIndex(model.players(), {
      stateToPlayer: "self",
    });
    var allyIndex = _.findIndex(model.players(), {
      stateToPlayer: "allied_eco",
    });
    var teamIndex = Math.min(playerIndex, allyIndex);
    var allyCount = aiAllyArmyIndex.length;

    planetUnitCounts.forEach(function (planetUnitCount) {
      var unitsPerAlly = planetUnitCount.splice(teamIndex, allyCount + 1);
      var unitsPerEnemy = planetUnitCount;
      var alliedUnits = unitsPerAlly.reduce(function (acc, val) {
        return acc + val;
      });
      var enemyUnits = unitsPerEnemy.reduce(function (acc, val) {
        return acc + val;
      });
      alliedUnitsPerPlanet.push(alliedUnits);
      enemyUnitsPerPlanet.push(enemyUnits);
    });

    return {
      allies: alliedUnitsPerPlanet,
      enemies: enemyUnitsPerPlanet,
    };
  };

  var compareArmySizes = function (alliedUnitsPerPlanet, enemyUnitsPerPlanet) {
    var winningRatio = 4;
    var losingRatio = 1.5;
    var situationReports = [];

    alliedUnitsPerPlanet.forEach(function (alliedUnits, planetIndex) {
      var enemyUnits = enemyUnitsPerPlanet[planetIndex];
      if (alliedUnits === 0) {
        situationReports.push("absent");
      } else if (enemyUnits === 0) {
        situationReports.push("alone");
      } else if (alliedUnits >= enemyUnits * winningRatio) {
        situationReports.push("winning");
      } else if (alliedUnits <= enemyUnits * losingRatio) {
        situationReports.push("losing");
      } else {
        situationReports.push("ok");
      }
    });

    return situationReports;
  };

  var getSituationReports = function (planetUnitCounts, aiAllyArmyIndex) {
    var friendAndFoe = separateFriendFromFoe(planetUnitCounts, aiAllyArmyIndex);
    var alliedUnitsPerPlanet = friendAndFoe.allies;
    var enemyUnitsPerPlanet = friendAndFoe.enemies;
    var situationReports = compareArmySizes(
      alliedUnitsPerPlanet,
      enemyUnitsPerPlanet
    );
    return situationReports;
  };

  var previousPlanetStatus = ko
    .observableArray()
    .extend({ session: "ai_chat_planet_statuses" });
  var previousImportantPlanetStatus = ko
    .observableArray()
    .extend({ session: "ai_chat_important_planet_statuses" });

  var checkIfWorthReporting = function (planetIndex, report) {
    var importantStatus = new Set();
    importantStatus.add("winning");
    importantStatus.add("losing");

    if (
      previousPlanetStatus()[planetIndex] === "ok" && // avoid swingy reporting
      report !== previousImportantPlanetStatus()[planetIndex] &&
      importantStatus.has(report) // to avoid report spam
    ) {
      previousImportantPlanetStatus()[planetIndex] = report;
      previousImportantPlanetStatus.valueHasMutated();
      return true;
    }

    return false;
  };

  return {
    status: function (
      playerRequested,
      aiAllyArmyIndex,
      enemyArmyIndex,
      aiAllies
    ) {
      var liveAllies = _.filter(aiAllies, { defeated: false });

      if (_.isEmpty(liveAllies)) {
        return;
      }

      var allAIIndex = aiAllyArmyIndex.concat(enemyArmyIndex);
      units.countAll(allAIIndex).then(function (planetUnitCounts) {
        var situationReports = getSituationReports(
          planetUnitCounts,
          aiAllyArmyIndex
        );
        var ally = _.shuffle(liveAllies)[0];
        situationReports.forEach(function (report, planetIndex) {
          if (report === "absent") {
            previousPlanetStatus()[planetIndex] = report;
            previousPlanetStatus.valueHasMutated();
            return;
          }

          var worthReporting = checkIfWorthReporting(planetIndex, report);

          if (playerRequested === true || worthReporting === true) {
            chat.send("team", ally.name, report, planetIndex);
          }

          previousPlanetStatus()[planetIndex] = report;
          previousPlanetStatus.valueHasMutated();
        });
      });
    },
  };
});
