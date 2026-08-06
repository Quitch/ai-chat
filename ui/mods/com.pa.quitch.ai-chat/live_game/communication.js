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
    var checkInterval;
    // a pending _.delay cannot be cancelled, so scheduled checks carry the
    // game they were scheduled for and drop themselves if it has moved on
    var gameEpoch = 0;
    var allyCheckSpread = 4000; // must stay under units.js's lookup lifetime
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
        var reportedThreats = observableArray("aic_enemy_threats");
        var orbitalMassing = observableArray("aic_enemy_orbital");
        var movingPlanets = observableArray("aic_moving_planets");
        var commanderPlanets = observableArray("aic_commander_planet");
        var alliedAdvancedReported = observableArray("aic_ally_t2_check");
        var alliedOrbitalReported = observableArray("aic_ally_orbital_check");
        var alliedCatalystReported = observableArray("aic_ally_catalyst_check");
        var alliedNukeReported = observableArray("aic_ally_nuke_check");
        var alliedTitanReported = observableArray("aic_ally_titan_check");
        var alliedUnitCannonReported = observableArray(
          "aic_ally_unit_cannon_check"
        );
        processedLanding(false);
        communicatedLanding(false);
        colonisedPlanets([]);
        previousPlanetStatus([]);
        previousImportantPlanetStatus([]);
        enemyContact([]);
        reportedThreats([]);
        orbitalMassing([]);
        movingPlanets([]);
        commanderPlanets([]);
        previousUnitCount([]);
        alliedAdvancedReported([]);
        alliedOrbitalReported([]);
        alliedCatalystReported([]);
        alliedNukeReported([]);
        alliedTitanReported([]);
        alliedUnitCannonReported([]);
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
          api
            .getWorldView()
            .whenPlanetsReady()
            .then(function () {
              landing.location(aiAllyArmyIndex, aiAllies);
            });
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
    console.error("AI Chat: " + (e.stack || e.message || e));
  }
}
aiCommunications();
