define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var sumOfArray = function (unitCounts) {
    return _.reduce(
      unitCounts,
      function (total, value) {
        return total + value;
      },
      0
    );
  };

  var separateFriendFromFoe = function (planetUnitCounts, teamArmyIndex) {
    var alliedUnitsPerPlanet = [];
    var enemyUnitsPerPlanet = [];

    planetUnitCounts.forEach(function (planetUnitCount) {
      var unitsPerAlly = _.take(planetUnitCount, teamArmyIndex.length);
      var unitsPerEnemy = _.drop(planetUnitCount, teamArmyIndex.length);
      alliedUnitsPerPlanet.push(sumOfArray(unitsPerAlly));
      enemyUnitsPerPlanet.push(sumOfArray(unitsPerEnemy));
    });

    return {
      allies: alliedUnitsPerPlanet,
      enemies: enemyUnitsPerPlanet,
    };
  };

  var compareArmySizes = function (alliedUnitsPerPlanet, enemyUnitsPerPlanet) {
    var winningRatio = 4;
    var losingRatio = 1.5; // assume imperfect information
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

  var getSituationReports = function (planetUnitCounts, teamArmyIndex) {
    var friendAndFoe = separateFriendFromFoe(planetUnitCounts, teamArmyIndex);
    return {
      reports: compareArmySizes(friendAndFoe.allies, friendAndFoe.enemies),
      allies: friendAndFoe.allies,
      enemies: friendAndFoe.enemies,
    };
  };

  // the statuses that mean we still hold the planet. threats.js asks before
  // warning about an enemy fleet - a warning about somewhere we are already
  // losing tells the player nothing they do not know
  var secureStatus = ["alone", "winning", "ok"];

  var observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  var previousPlanetStatus = observableArray("aic_planet_statuses");
  var previousImportantPlanetStatus = observableArray(
    "aic_important_planet_statuses"
  );
  var enemyContact = observableArray("aic_enemy_contact");

  var checkForFirstContact = function (planetIndex, alliedUnits, enemyUnits) {
    var contested = alliedUnits > 0 && enemyUnits > 0;

    if (contested === (enemyContact()[planetIndex] === true)) {
      return false;
    }

    enemyContact()[planetIndex] = contested;
    enemyContact.valueHasMutated();
    return contested;
  };

  var livingArmies = function (armyIndex) {
    var players = model.players();
    return _.filter(armyIndex, function (index) {
      return players[index] && !players[index].defeated;
    });
  };

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
      teamArmyIndex,
      enemyArmyIndex,
      aiAllies
    ) {
      var liveAllies = _.filter(aiAllies, { defeated: false });

      if (_.isEmpty(liveAllies)) {
        return;
      }

      var liveTeamArmyIndex = livingArmies(teamArmyIndex);
      var allArmyIndex = liveTeamArmyIndex.concat(livingArmies(enemyArmyIndex));
      units.countAll(allArmyIndex).then(function (planetUnitCounts) {
        var situation = getSituationReports(
          planetUnitCounts,
          liveTeamArmyIndex
        );
        var ally = _.shuffle(liveAllies)[0];
        situation.reports.forEach(function (report, planetIndex) {
          var firstContact = checkForFirstContact(
            planetIndex,
            situation.allies[planetIndex],
            situation.enemies[planetIndex]
          );

          if (firstContact) {
            chat.send("team", ally.name, "enemyContact", planetIndex);
          }

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
    secure: function (planetIndex) {
      return _.includes(secureStatus, previousPlanetStatus()[planetIndex]);
    },
  };
});
