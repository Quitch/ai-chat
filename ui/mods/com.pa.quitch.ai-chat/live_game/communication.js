var aiCommunicationsLoaded;

function aiCommunications() {
  if (aiCommunicationsLoaded) {
    return;
  }

  aiCommunicationsLoaded = true;

  try {
    var observableArray = function (string) {
      return ko.observableArray().extend({ session: string });
    };

    var observable = function (string) {
      return ko.observable().extend({ session: string });
    };

    var aiAllyArmyIndex = [];
    var teamArmyIndex = []; // the player and their allies, human or AI
    var enemyArmyIndex = [];
    var processedLanding = observable("aic_processed_landing");
    var communicatedLanding = observable("aic_communicated_landing");
    var checkInterval;
    // a pending _.delay cannot be cancelled, so scheduled checks carry the
    // game they were scheduled for and drop themselves if it has moved on
    var gameEpoch = 0;
    var allyCheckSpread = 4000; // must stay under units.js's lookup lifetime
    var allyState = "allied_eco";
    var enemyState = "hostile";

    // a defeated player is a spectator, and stock blanks every army's
    // stateToPlayer for a spectator, so relations are read from
    // diplomaticState instead
    var relationTo = function (army, armyId) {
      var relation = army.diplomaticState && army.diplomaticState[armyId];
      return relation && relation.state;
    };

    var isAlliedTo = function (army, armyId) {
      return _.includes(["allied", allyState], relationTo(army, armyId));
    };

    // stock clears armyId when the game ends, before the kill alert for the
    // army whose defeat ended it arrives, so the kill reactions keep the last
    // id. The checks read armyId itself and stop with the game
    var playerArmyId = model.armyId();
    model.armyId.subscribe(function (armyId) {
      if (armyId !== undefined) {
        playerArmyId = armyId;
      }
    });

    var findAiAllies = function (allPlayers) {
      return _.filter(allPlayers, function (army) {
        return army.ai === 1 && relationTo(army, model.armyId()) === allyState;
      });
    };

    var findEnemies = function (allPlayers) {
      return _.filter(allPlayers, function (army) {
        return relationTo(army, model.armyId()) === enemyState;
      });
    };

    // model variables may not be populated yet
    var planets = model.planetListState().planets;
    var planetCount = planets.length - 1; // last planet is not a planet
    var players = model.players();
    var player = model.player();
    var ais = _.filter(players, { ai: 1 });
    var aiAllies = findAiAllies(players);
    var enemies = findEnemies(players);

    var identifyFriendAndFoe = function (allAis, allPlayers) {
      // avoid duplicates if this is called more than once
      aiAllyArmyIndex = [];
      teamArmyIndex = [];
      enemyArmyIndex = [];
      if (!_.isEmpty(allAis)) {
        var playerIndex = _.findIndex(allPlayers, { id: model.armyId() });
        if (playerIndex !== -1) {
          teamArmyIndex.push(playerIndex);
        }

        aiAllies.forEach(function (ai) {
          var allyIndex = _.findIndex(allPlayers, ai);
          aiAllyArmyIndex.push(allyIndex);
          teamArmyIndex.push(allyIndex);
        });

        allPlayers.forEach(function (army, armyIndex) {
          if (army.ai !== 1 && isAlliedTo(army, model.armyId())) {
            teamArmyIndex.push(armyIndex);
          }
        });

        enemies.forEach(function (enemy) {
          var enemyIndex = _.findIndex(allPlayers, enemy);
          enemyArmyIndex.push(enemyIndex);
        });
      }
    };
    identifyFriendAndFoe(ais, players);

    var sessionArrayKeys = [
      "aic_colonised_planets",
      "aic_previous_units",
      "aic_planet_statuses",
      "aic_important_planet_statuses",
      "aic_enemy_contact",
      "aic_enemy_threats",
      "aic_enemy_orbital",
      "aic_moving_planets",
      "aic_planet_targets",
      "aic_commander_planet",
      "aic_enemy_commander_planets",
      "aic_ally_t2_check",
      "aic_ally_orbital_check",
      "aic_ally_catalyst_check",
      "aic_ally_nuke_check",
      "aic_ally_titan_check",
      "aic_ally_unit_cannon_check",
    ];

    var clearSessionState = function () {
      processedLanding(false);
      communicatedLanding(false);
      sessionArrayKeys.forEach(function (key) {
        observableArray(key)([]);
      });
    };

    // stock keeps the player's army landing for the whole of a loaded save,
    // so processedLanding never turns true there and detectNewGame misses the
    // next game. Each game this client starts gets a new invite_uuid and a
    // join copies the host's, but a direct connect leaves it empty; then any
    // scene load but a reload counts as a new game. This must run before the
    // check modules create their session observables
    var gameId = observable("invite_uuid")();
    var sceneReloaded =
      performance.navigation.type === performance.navigation.TYPE_RELOAD;
    var sessionGameId = observable("aic_game_id");
    if (gameId ? sessionGameId() !== gameId : !sceneReloaded) {
      clearSessionState();
      sessionGameId(gameId);
    }

    var detectNewGame = function (playerInfo) {
      var playerSelectingSpawn = playerInfo.landing;
      if (processedLanding() === true && playerSelectingSpawn === true) {
        clearSessionState();
        gameEpoch++;
        clearInterval(checkInterval);
        checksInitialised = false;
      }
    };
    detectNewGame(player);

    var randomPercentageAdjustment = function (min, max) {
      return Math.random() * (max - min) + min;
    };

    var generateInterval = function () {
      var baseInterval = 10000; // 10 seconds
      return baseInterval * randomPercentageAdjustment(0.8, 1.2);
    };

    var checksInitialised = false;

    var initialiseChecks = function (allies) {
      if (checksInitialised || _.isEmpty(allies)) {
        return;
      }

      checksInitialised = true;

      var epoch = gameEpoch;

      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/colony.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/invasion.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/tech.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/threats.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/commander.js",
      ], function (colony, invasion, tech, report, threats, commander) {
        // a new game started while this require was outstanding already
        // cleared the interval we had not yet created
        if (epoch !== gameEpoch) {
          return;
        }

        // the army indices and ally list are rebuilt whenever the player
        // list changes, so an ally is scheduled by name and its position
        // resolved when its checks fire, never when they were scheduled
        var runAllyChecks = function (allyName, scheduledEpoch) {
          if (scheduledEpoch !== gameEpoch) {
            return;
          }

          var allyIndex = _.findIndex(aiAllies, { name: allyName });
          if (allyIndex === -1 || aiAllies[allyIndex].defeated) {
            return;
          }

          var ally = aiAllies[allyIndex];

          // read per tick rather than when the check was scheduled, so
          // colony and invasion fall silent if the system is reduced to a
          // single planet
          if (planetCount > 1) {
            colony.check(aiAllyArmyIndex, ally, allyIndex);
            invasion.check(aiAllyArmyIndex, ally, allyIndex);
            commander.check(aiAllyArmyIndex, ally, allyIndex);
          }

          tech.check(aiAllyArmyIndex, ally, allyIndex);
        };

        checkInterval = setInterval(function () {
          report.status(false, teamArmyIndex, enemyArmyIndex, aiAllies);
          threats.check(enemyArmyIndex, aiAllies, teamArmyIndex);

          // report.status looks up every living army before it returns, so
          // an ally checked within the unit lookup lifetime costs nothing
          // further. Spreading the allies evenly across that window is what
          // stops them all speaking at once, and spreading them by a fixed
          // amount rather than a random one keeps each ally's gap between
          // checks equal to the interval. The widest offset stays under the
          // shortest interval, so an ally's checks cannot overlap
          aiAllies.forEach(function (ally, allyIndex) {
            var offset = allyIndex * (allyCheckSpread / aiAllies.length);
            _.delay(runAllyChecks, offset, ally.name, gameEpoch);
          });
        }, generateInterval());
      });
    };
    initialiseChecks(aiAllies);

    model.players.subscribe(function () {
      players = model.players();
      player = model.player();
      ais = _.filter(players, { ai: 1 });
      aiAllies = findAiAllies(players);
      enemies = findEnemies(players);
      planets = model.planetListState().planets;
      planetCount = planets.length - 1; // last entry in array isn't a planet
      var startingPlanetsCount = _.filter(planets, {
        starting_planet: true,
      }).length;
      var playerHasAllies = !_.isEmpty(aiAllies);
      var playerSelectingSpawn = player.landing;

      detectNewGame(player);
      identifyFriendAndFoe(ais, players);
      initialiseChecks(aiAllies);

      if (!playerSelectingSpawn && !processedLanding()) {
        processedLanding(true);
      }

      if (
        !playerSelectingSpawn &&
        !communicatedLanding() &&
        startingPlanetsCount > 1 &&
        playerHasAllies
      ) {
        // each army_state notifies twice, and both now list the allies, so
        // mark the landing told before the require callback runs
        communicatedLanding(true);
        require([
          "coui://ui/mods/com.pa.quitch.ai-chat/live_game/landing.js",
        ], function (landing) {
          api
            .getWorldView()
            .whenPlanetsReady()
            .then(function () {
              landing.location(aiAllyArmyIndex, aiAllies);
            });
        });
      }
    });

    var survivingAIAllyOf = function (armyId) {
      return _.sample(
        _.filter(players, function (survivor) {
          return (
            survivor.ai === 1 &&
            !survivor.defeated &&
            isAlliedTo(survivor, armyId)
          );
        })
      );
    };

    var speak = function (chat, audience, speaker, type) {
      if (speaker) {
        chat.send(audience, speaker.name, type);
      }
    };

    handlers.kills = function (payload) {
      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
      ], function (chat) {
        var defeated = players[payload[0].index];
        var killer = payload[1] && players[payload[1].index];
        // the alert for a surrender can name an army that was already
        // defeated, which killed nothing
        if (killer && killer.defeated) {
          killer = undefined;
        }
        var playerId = playerArmyId;
        var killerIsAI = killer && killer.ai === 1;
        var killerIsTeamHuman =
          killer &&
          killer.ai !== 1 &&
          (killer.id === playerId || isAlliedTo(killer, playerId));
        var defeatedIsAIAlly =
          defeated.ai === 1 && relationTo(defeated, playerId) === allyState;
        var defeatedIsEnemy = relationTo(defeated, playerId) === enemyState;

        if (killerIsAI) {
          chat.send("global", killer.name, "kill");
        }

        if (defeatedIsAIAlly) {
          chat.send("team", defeated.name, "defeat");
        }

        if (defeated.id === playerId) {
          speak(chat, "team", survivingAIAllyOf(playerId), "playerDefeated");
        }

        if (killerIsTeamHuman && defeatedIsEnemy) {
          speak(chat, "team", survivingAIAllyOf(playerId), "teamKill");
        }

        if (defeated.ai === 1 && defeatedIsEnemy) {
          speak(
            chat,
            "global",
            survivingAIAllyOf(defeated.id),
            "enemyAllyLost"
          );
        }
      });
    };

    handlers.reportIn = function () {
      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
      ], function (report) {
        report.status(true, teamArmyIndex, enemyArmyIndex, aiAllies);
      });
    };
  } catch (e) {
    console.error(e);
    console.error("AI Chat: " + (e.stack || e.message || e));
  }
}
aiCommunications();
