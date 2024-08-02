define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  const sumOfArray = function (units) {
    return _.reduce(units, function (total, value) {
      return total + value;
    });
  };

  const indexOfPlayers = function (string) {
    return _.findIndex(model.players(), {
      stateToPlayer: string,
    });
  };

  const separateFriendFromFoe = function (planetUnitCounts, aiAllyArmyIndex) {
    const alliedUnitsPerPlanet = [];
    const enemyUnitsPerPlanet = [];
    const playerIndex = indexOfPlayers("self");
    const allyIndex = indexOfPlayers("allied_eco");
    const teamIndex = Math.min(playerIndex, allyIndex);
    const allyCount = aiAllyArmyIndex.length;

    planetUnitCounts.forEach(function (planetUnitCount) {
      const unitsPerAlly = planetUnitCount.splice(teamIndex, allyCount + 1);
      const unitsPerEnemy = planetUnitCount;
      const alliedUnits = sumOfArray(unitsPerAlly);
      const enemyUnits = sumOfArray(unitsPerEnemy);
      alliedUnitsPerPlanet.push(alliedUnits);
      enemyUnitsPerPlanet.push(enemyUnits);
    });

    return {
      allies: alliedUnitsPerPlanet,
      enemies: enemyUnitsPerPlanet,
    };
  };

  const compareArmySizes = function (
    alliedUnitsPerPlanet,
    enemyUnitsPerPlanet
  ) {
    const winningRatio = 4;
    const losingRatio = 1.5; // assume imperfect information
    const situationReports = [];

    alliedUnitsPerPlanet.forEach(function (alliedUnits, planetIndex) {
      const enemyUnits = enemyUnitsPerPlanet[planetIndex];
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

  const getSituationReports = function (planetUnitCounts, aiAllyArmyIndex) {
    const friendAndFoe = separateFriendFromFoe(
      planetUnitCounts,
      aiAllyArmyIndex
    );
    const alliedUnitsPerPlanet = friendAndFoe.allies;
    const enemyUnitsPerPlanet = friendAndFoe.enemies;
    const situationReports = compareArmySizes(
      alliedUnitsPerPlanet,
      enemyUnitsPerPlanet
    );
    return situationReports;
  };

  const observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  const previousPlanetStatus = observableArray("aic_planet_statuses");
  const previousImportantPlanetStatus = observableArray(
    "aic_important_planet_statuses"
  );

  const checkIfWorthReporting = function (planetIndex, report) {
    const importantStatus = new Set();
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
      const liveAllies = _.filter(aiAllies, { defeated: false });

      if (_.isEmpty(liveAllies)) {
        return;
      }

      const allAIIndex = aiAllyArmyIndex.concat(enemyArmyIndex);
      units.countAll(allAIIndex).then(function (planetUnitCounts) {
        const situationReports = getSituationReports(
          planetUnitCounts,
          aiAllyArmyIndex
        );
        const ally = _.shuffle(liveAllies)[0];
        situationReports.forEach(function (report, planetIndex) {
          if (report === "absent") {
            previousPlanetStatus()[planetIndex] = report;
            previousPlanetStatus.valueHasMutated();
            return;
          }

          const worthReporting = checkIfWorthReporting(planetIndex, report);

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
