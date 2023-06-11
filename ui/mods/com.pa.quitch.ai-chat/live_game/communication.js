var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var aiAllyArmyIndex = [];
      var enemyArmyIndex = [];
      var processedLanding = ko
        .observable(false)
        .extend({ session: "ai_chat_processed_landing" });
      var communicatedLanding = ko
        .observable(false)
        .extend({ session: "ai_chat_communicated_landing" });
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
        enemyArmyIndex = [];
        if (!_.isEmpty(allAis)) {
          aiAllies.forEach(function (ai) {
            var allyIndex = _.findIndex(allPlayers, ai);
            aiAllyArmyIndex.push(allyIndex);
          });

          enemies.forEach(function (enemy) {
            var enemyIndex = _.findIndex(allPlayers, enemy);
            enemyArmyIndex.push(enemyIndex);
          });
        }
      };
      identifyFriendAndFoe(ais, players);

      var detectNewGame = function (player) {
        var playerSelectingSpawn = player.landing;
        if (processedLanding() === true && playerSelectingSpawn === true) {
          var currentlyColonisedPlanets = ko
            .observableArray()
            .extend({ session: "ai_chat_colonised_planets" });
          var previousUnitCount = ko
            .observableArray()
            .extend({ session: "ai_chat_previous_units" });
          var previousPlanetStatus = ko
            .observableArray()
            .extend({ session: "ai_chat_planet_statuses" });
          var previousImportantPlanetStatus = ko
            .observableArray()
            .extend({ session: "ai_chat_important_planet_statuses" });
          var alliedAdvancedTechReported = ko
            .observableArray()
            .extend({ session: "ai_chat_ally_t2_check" });
          var alliedOrbitalTechReported = ko
            .observableArray()
            .extend({ session: "ai_chat_ally_orbital_check" });
          processedLanding(false);
          communicatedLanding(false);
          currentlyColonisedPlanets([]);
          previousPlanetStatus([]);
          previousImportantPlanetStatus([]);
          previousUnitCount([]);
          alliedAdvancedTechReported([]);
          alliedOrbitalTechReported([]);
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
        var alliedT2CheckInterval = [];
        var alliedOrbitalCheckInterval = [];

        allies.forEach(function (ally, i) {
          require([
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/colony.js",
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/invasion.js",
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/tech.js",
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
          ], function (colony, invasion, tech, report) {
            if (planetCount > 1) {
              setInterval(
                colony.check,
                generateInterval(),
                aiAllyArmyIndex,
                ally,
                i
              );
              setInterval(
                invasion.check,
                generateInterval(),
                aiAllyArmyIndex,
                ally,
                i
              );
            }

            alliedT2CheckInterval[i] = setInterval(
              tech.alliedT2Check,
              generateInterval(),
              aiAllyArmyIndex,
              ally,
              i,
              alliedT2CheckInterval
            );
            alliedOrbitalCheckInterval[i] = setInterval(
              tech.alliedOrbitalCheck,
              generateInterval(),
              aiAllyArmyIndex,
              ally,
              i,
              alliedOrbitalCheckInterval
            );
            setInterval(
              report.status,
              generateInterval(),
              false,
              aiAllyArmyIndex,
              enemyArmyIndex,
              aiAllies
            );
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
          report.status(true, aiAllyArmyIndex, enemyArmyIndex, aiAllies);
        });
      };
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
