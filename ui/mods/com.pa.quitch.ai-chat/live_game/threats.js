define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/superweapons.js",
], function (chat, units, superweapons) {
  var reportedThreats = ko
    .observableArray()
    .extend({ session: "aic_enemy_threats" });

  var threats = [
    { desiredUnits: superweapons.nuke, message: "enemyNuke" },
    { desiredUnits: superweapons.unitCannon, message: "enemyUnitCannon" },
    { desiredUnits: superweapons.halley, message: "enemyHalley" },
    { desiredUnits: superweapons.catalyst, message: "enemyCatalyst" },
    { desiredUnits: superweapons.titan, message: "enemyTitan" },
  ];

  var orbitalForce = 8;
  var orbitalMassing = ko
    .observableArray()
    .extend({ session: "aic_enemy_orbital" });
  var movingPlanets = ko
    .observableArray()
    .extend({ session: "aic_moving_planets" });

  var livingArmies = function (armyIndex) {
    var players = model.players();
    return _.filter(armyIndex, function (index) {
      return players[index] && !players[index].defeated;
    });
  };

  var reportEdge = function (state, seen, active, ally, message, planetIndex) {
    if (active === _.includes(state(), seen)) {
      return;
    }

    if (!active) {
      state.remove(seen);
      return;
    }

    state.push(seen);
    chat.send("team", ally.name, message, planetIndex);
  };

  var checkOrbitalMassing = function (
    ally,
    armyIndex,
    orbitalCounts,
    teamUnits
  ) {
    orbitalCounts.forEach(function (orbitalCount, planetIndex) {
      reportEdge(
        orbitalMassing,
        armyIndex + ":" + planetIndex,
        orbitalCount >= orbitalForce && teamUnits[planetIndex] > 0,
        ally,
        "enemyOrbital",
        planetIndex
      );
    });
  };

  var checkForPlanetMovement = function (ally) {
    var planets = model.planetListState().planets;
    var planetCount = planets.length - 1; // last planet is not a planet

    for (var planetIndex = 0; planetIndex < planetCount; planetIndex++) {
      var planet = planets[planetIndex];
      reportEdge(
        movingPlanets,
        planetIndex,
        Boolean(planet && planet.thrust_active),
        ally,
        "planetMoving",
        planetIndex
      );
    }
  };

  var reportThreats = function (ally, armyIndex, threat, planets) {
    planets.forEach(function (planetIndex) {
      var seen = armyIndex + ":" + threat.message + ":" + planetIndex;

      if (_.includes(reportedThreats(), seen)) {
        return;
      }

      reportedThreats.push(seen);
      chat.send("team", ally.name, threat.message, planetIndex);
    });
  };

  return {
    check: function (enemyArmyIndex, aiAllies, teamArmyIndex) {
      var liveAllies = _.filter(aiAllies, { defeated: false });
      var liveEnemies = livingArmies(enemyArmyIndex);

      if (_.isEmpty(liveAllies)) {
        return;
      }

      checkForPlanetMovement(_.shuffle(liveAllies)[0]);

      if (_.isEmpty(liveEnemies)) {
        return;
      }

      var desiredUnitCount = 1;
      var sets = threats.map(function (threat) {
        return {
          desiredUnits: threat.desiredUnits,
          desiredUnitCount: desiredUnitCount,
        };
      });

      var teamPresence = units
        .countAll(livingArmies(teamArmyIndex))
        .then(function (planetUnitCounts) {
          return planetUnitCounts.map(function (perArmy) {
            return _.reduce(
              perArmy,
              function (total, count) {
                return total + count;
              },
              0
            );
          });
        });

      liveEnemies.forEach(function (armyIndex) {
        units
          .checkForDesiredSets(armyIndex, sets)
          .then(function (planetsWithThreat) {
            var ally = _.shuffle(liveAllies)[0];

            threats.forEach(function (threat, i) {
              reportThreats(ally, armyIndex, threat, planetsWithThreat[i][0]);
            });
          });

        Promise.all([
          units.countDesired(armyIndex, ["orbital_"]),
          teamPresence,
        ]).then(function (counts) {
          checkOrbitalMassing(
            _.shuffle(liveAllies)[0],
            armyIndex,
            counts[0],
            counts[1]
          );
        });
      });
    },
  };
});
