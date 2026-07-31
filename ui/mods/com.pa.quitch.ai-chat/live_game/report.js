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

    // units.countAll() was given the team first, then the enemies, and
    // returns its counts in that same order. Read rather than splice - the
    // counts belong to the caller, and emptying them leaves whatever reads
    // them next holding only the enemy half
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

  var observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  var previousPlanetStatus = observableArray("aic_planet_statuses");
  var previousImportantPlanetStatus = observableArray(
    "aic_important_planet_statuses"
  );
  var enemyContact = observableArray("aic_enemy_contact");

  // the enemy reaching a planet we hold is the most actionable thing the
  // report sees, and the status buckets do not surface it - a planet can go
  // from alone to ok without a word being said. Tracked as an edge so an
  // incursion is announced once, and announced again if a later one follows
  // the first being driven off
  var checkForFirstContact = function (planetIndex, alliedUnits, enemyUnits) {
    var contested = alliedUnits > 0 && enemyUnits > 0;

    if (contested === (enemyContact()[planetIndex] === true)) {
      return false;
    }

    enemyContact()[planetIndex] = contested;
    enemyContact.valueHasMutated();
    return contested;
  };

  // a defeated player owns no units, so polling them costs a call per planet
  // per tick to learn a count we already know is zero
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

      // countAll returns its counts in the order it was given the armies, so
      // the team it is split on must be the same filtered list we passed in
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
  };
});
