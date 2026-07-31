define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var reportedThreats = ko
    .observableArray()
    .extend({ session: "aic_enemy_threats" });

  // Matching is by substring against unit spec paths, so these have to be
  // specific enough not to catch the thing that counters them. The Bugs
  // entries were resolved against that mod's published unit list rather than
  // guessed at from the vanilla names
  var threats = [
    {
      desiredUnits: [
        "land/nuke_launcher", // anchored so it cannot match anti_nuke_launcher
        "bug_nuke", // Bugs
      ],
      message: "enemyNuke",
    },
    {
      desiredUnits: ["unit_cannon"], // the Bugs ship no equivalent
      message: "enemyUnitCannon",
    },
    {
      desiredUnits: [
        "delta_v_engine",
        "bug_halley", // Bugs
      ],
      message: "enemyHalley",
    },
    {
      desiredUnits: [
        "control_module",
        "bug_catalyst", // Bugs
      ],
      message: "enemyCatalyst",
    },
    {
      // named individually - "titan" alone also matches the tutorial commander
      desiredUnits: [
        "titan_bot",
        "titan_vehicle",
        "titan_air",
        "titan_orbital",
        "titan_structure",
        // Bugs
        "bug_titan",
        "bug_air_titan",
        "bug_laser_spider",
        "bug_matriarch",
        "bug_rag",
      ],
      message: "enemyTitan",
    },
  ];

  // an orbital force this size over a planet we hold is a staging area, not a
  // patrol, and it precedes almost every invasion
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

  // held as edges rather than one-shot flags, so a force that disperses and
  // returns is reported both times
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

  // read straight off the planet list, which is already on the player's own
  // screen, so this draws attention to something rather than revealing it.
  // It deliberately does not say whose planet it is: thrust_control is
  // relative to the local player and does not tell a teammate from an enemy
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

  // once per army, threat and planet. A launcher that is destroyed and rebuilt
  // in the same place is not news; one built somewhere new is
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
    // deliberately reports only what the AI can see. Fog of war limits this to
    // scouted planets, which is the difference between intel and cheating
    check: function (enemyArmyIndex, aiAllies, teamArmyIndex) {
      var liveAllies = _.filter(aiAllies, { defeated: false });
      var liveEnemies = livingArmies(enemyArmyIndex);

      if (_.isEmpty(liveAllies)) {
        return;
      }

      // a planet under thrust is worth mentioning whoever is left to see it
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

      // where our team is, so an orbital force is only called out when it is
      // gathering over something of ours
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
