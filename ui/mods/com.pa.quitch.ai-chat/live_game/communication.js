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
    var teamArmyIndex = []; // the player and their AI allies
    var enemyArmyIndex = [];
    var processedLanding = observable("aic_processed_landing");
    var communicatedLanding = observable("aic_communicated_landing");
    // the interval handles for each ally's checks, so they can be stopped when
    // that ally is defeated. Allies are held by name because the ally objects
    // captured when the checks were created are snapshots, and the ally list
    // is rebuilt - and reordered - whenever a player leaves
    var allyCheckIntervals = [];

    var stopChecks = function (ally) {
      ally.handles.forEach(function (handle) {
        clearInterval(handle);
      });
      ally.stopped = true;
    };

    var stopDefeatedAllyChecks = function (allPlayers) {
      allyCheckIntervals.forEach(function (ally) {
        if (ally.stopped) {
          return;
        }

        var currentAlly = _.find(allPlayers, { name: ally.name });
        if (currentAlly && currentAlly.defeated) {
          stopChecks(ally);
        }
      });
    };
    var allyState = "allied_eco";
    var enemyState = "hostile";
    // model variables may not be populated yet
    var planets = model.planetListState().planets;
    var planetCount = planets.length - 1; // last planet is not a planet
    var players = model.players();
    var player = model.player();
    var ais = _.filter(players, { ai: 1 });
    var aiAllies = _.filter(ais, { stateToPlayer: allyState });
    var enemies = _.filter(players, { stateToPlayer: enemyState });

    var identifyFriendAndFoe = function (allAis, allPlayers) {
      // avoid duplicates if this is called more than once
      aiAllyArmyIndex = [];
      teamArmyIndex = [];
      enemyArmyIndex = [];
      if (!_.isEmpty(allAis)) {
        var playerIndex = _.findIndex(allPlayers, { stateToPlayer: "self" });
        if (playerIndex !== -1) {
          teamArmyIndex.push(playerIndex);
        }

        aiAllies.forEach(function (ai) {
          var allyIndex = _.findIndex(allPlayers, ai);
          aiAllyArmyIndex.push(allyIndex);
          teamArmyIndex.push(allyIndex);
        });

        enemies.forEach(function (enemy) {
          var enemyIndex = _.findIndex(allPlayers, enemy);
          enemyArmyIndex.push(enemyIndex);
        });
      }
    };
    identifyFriendAndFoe(ais, players);

    var detectNewGame = function (playerInfo) {
      var playerSelectingSpawn = playerInfo.landing;
      if (processedLanding() === true && playerSelectingSpawn === true) {
        var colonisedPlanets = observableArray("aic_colonised_planets");
        var previousUnitCount = observableArray("aic_previous_units");
        var previousPlanetStatus = observableArray("aic_planet_statuses");
        var previousImportantPlanetStatus = observableArray(
          "aic_important_planet_statuses"
        );
        var enemyContact = observableArray("aic_enemy_contact");
        var alliedAdvancedReported = observableArray("aic_ally_t2_check");
        var alliedOrbitalReported = observableArray("aic_ally_orbital_check");
        var alliedCatalystReported = observableArray("aic_ally_catalyst_check");
        processedLanding(false);
        communicatedLanding(false);
        colonisedPlanets([]);
        previousPlanetStatus([]);
        previousImportantPlanetStatus([]);
        enemyContact([]);
        previousUnitCount([]);
        alliedAdvancedReported([]);
        alliedOrbitalReported([]);
        alliedCatalystReported([]);
        // the running checks hold snapshots of the last game's allies, so they
        // are torn down here and rebuilt by initialiseChecks for the new game
        allyCheckIntervals.forEach(stopChecks);
        allyCheckIntervals = [];
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

    // SPIKE-1: temporary, reverted once the probe has reported
    var aiChatProbeEnabled = true;

    var initialiseChecks = function (allies) {
      if (checksInitialised || _.isEmpty(allies)) {
        return;
      }

      checksInitialised = true;

      // SPIKE-1: two runs so we see both an early and a developed army
      if (aiChatProbeEnabled) {
        require([
          "coui://ui/mods/com.pa.quitch.ai-chat/live_game/probe.js",
        ], function (probe) {
          _.delay(probe.run, 30000, aiAllyArmyIndex, allies);
          _.delay(probe.run, 120000, aiAllyArmyIndex, allies);
        });
      }

      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/colony.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/invasion.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/tech.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
      ], function (colony, invasion, tech, report) {
        // the army indices and ally list are rebuilt whenever the player
        // list changes, so each check reads them when it fires rather than
        // taking a copy now

        // one report covers the whole team, so it is not per ally
        setInterval(function () {
          report.status(false, teamArmyIndex, enemyArmyIndex, aiAllies);
        }, generateInterval());

        // one interval per ally rather than one per check, so an ally's
        // checks land on the same tick and share their unit lookups. The
        // jitter stays between allies, which is what stops every ally
        // speaking at once
        allies.forEach(function (ally, i) {
          var handle = setInterval(function () {
            // read per tick rather than when the interval was created, so
            // colony and invasion fall silent if the system is reduced to a
            // single planet
            if (planetCount > 1) {
              colony.check(aiAllyArmyIndex, ally, i);
              invasion.check(aiAllyArmyIndex, ally, i);
            }

            tech.check(aiAllyArmyIndex, ally, i);
          }, generateInterval());

          allyCheckIntervals.push({
            name: ally.name,
            handles: [handle],
            stopped: false,
          });
        });
      });
    };
    initialiseChecks(aiAllies);

    model.players.subscribe(function () {
      players = model.players();
      player = model.player();
      ais = _.filter(players, { ai: 1 });
      aiAllies = _.filter(ais, { stateToPlayer: allyState });
      enemies = _.filter(players, { stateToPlayer: enemyState });
      planets = model.planetListState().planets;
      planetCount = planets.length - 1; // last entry in array isn't a planet
      var startingPlanetsCount = _.filter(planets, {
        starting_planet: true,
      }).length;
      var playerHasAllies = !_.isEmpty(aiAllies);
      var playerSelectingSpawn = player.landing;

      detectNewGame(player);
      identifyFriendAndFoe(ais, players);
      stopDefeatedAllyChecks(players);
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
        require([
          "coui://ui/mods/com.pa.quitch.ai-chat/live_game/landing.js",
        ], function (landing) {
          _.delay(landing.location, 10000, aiAllyArmyIndex, aiAllies); // delay to allow AI to spawn
          communicatedLanding(true);
        });
      }
    });

    handlers.kills = function (payload) {
      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
      ], function (chat) {
        var defeated = payload[0];
        var killer = payload[1];
        var killerIsAI = killer && players[killer.index].ai === 1;
        var defeatedIsAIAlly =
          players[defeated.index].ai === 1 &&
          players[defeated.index].stateToPlayer === allyState;

        if (killerIsAI) {
          chat.send("global", killer.name, "kill");
        }

        if (defeatedIsAIAlly) {
          chat.send("team", defeated.name, "defeat");
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
    console.error(JSON.stringify(e));
  }
}
aiCommunications();
