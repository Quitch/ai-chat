define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/superweapons.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
], function (chat, units, superweapons, report) {
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

  var orbitalForce = 8; // a gas giant has no ground, so any fleet counts
  // "orbital_" misses the Helios, the only titan named the other way around
  var allOrbital = ["orbital_", "titan_orbital"];
  // orbital units that can shoot at the surface - the SXX, Omega and Helios.
  // Legion's l_ and the Bugs' bug_ ports of the same units are caught by these
  // fragments, and Exiles ships no orbital units of its own, so no parallel
  // faction entries are needed. The Bugs' Chomper and orbital mine target
  // WL_Orbital only, so they are deliberately absent
  var antiGroundOrbital = [
    "orbital_laser",
    "orbital_battleship", // also the land drone the Bugs' one carries
    "titan_orbital",
  ];
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
    antiGroundCounts,
    teamUnits
  ) {
    var planets = model.planetListState().planets;

    orbitalCounts.forEach(function (orbitalCount, planetIndex) {
      var planet = planets[planetIndex];
      // a gas giant has no surface, so any fleet over one is the invasion. On
      // a planet with ground to hold, only a platform that can shoot down at
      // that ground is worth interrupting the player for
      var threatening =
        planet && planet.has_terrain === false
          ? orbitalCount >= orbitalForce
          : antiGroundCounts[planetIndex] > 0;

      reportEdge(
        orbitalMassing,
        armyIndex + ":" + planetIndex,
        // teamUnits is this tick's, report.secure() is the last tick's, so the
        // first still catches a planet lost since the last situation report
        threatening && teamUnits[planetIndex] > 0 && report.secure(planetIndex),
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

        // the second sweep is cache-served - units.js memoises each army's
        // units per planet, and this walks the same army on the same tick
        Promise.all([
          units.countDesired(armyIndex, allOrbital),
          units.countDesired(armyIndex, antiGroundOrbital),
          teamPresence,
        ]).then(function (counts) {
          checkOrbitalMassing(
            _.shuffle(liveAllies)[0],
            armyIndex,
            counts[0],
            counts[1],
            counts[2]
          );
        });
      });
    },
  };
});
