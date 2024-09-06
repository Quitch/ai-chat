var aiCommunicationsLoaded;

function aiCommunications() {
  if (aiCommunicationsLoaded) {
    return;
  }

  aiCommunicationsLoaded = true;

  try {
    const observableArray = function (string) {
      return ko.observableArray().extend({ session: string });
    };

    const observable = function (string) {
      return ko.observable().extend({ session: string });
    };

    var aiAllyArmyIndex = [];
    var enemyArmyIndex = [];
    const processedLanding = observable("aic_processed_landing");
    const communicatedLanding = observable("aic_communicated_landing");
    const allyState = "allied_eco";
    const enemyState = "hostile";
    // model variables may not be populated yet
    var planets = model.planetListState().planets;
    var planetCount = planets.length - 1; // last planet is not a planet
    var players = model.players();
    var player = model.player();
    var ais = _.filter(players, { ai: 1 });
    var aiAllies = _.filter(ais, { stateToPlayer: allyState });
    var enemies = _.filter(players, { stateToPlayer: enemyState });

    const identifyFriendAndFoe = function (allAis, allPlayers) {
      // avoid duplicates if this is called more than once
      aiAllyArmyIndex = [];
      enemyArmyIndex = [];
      if (!_.isEmpty(allAis)) {
        aiAllies.forEach(function (ai) {
          const allyIndex = _.findIndex(allPlayers, ai);
          aiAllyArmyIndex.push(allyIndex);
        });

        enemies.forEach(function (enemy) {
          const enemyIndex = _.findIndex(allPlayers, enemy);
          enemyArmyIndex.push(enemyIndex);
        });
      }
    };
    identifyFriendAndFoe(ais, players);

    const detectNewGame = function (playerInfo) {
      const playerSelectingSpawn = playerInfo.landing;
      if (processedLanding() === true && playerSelectingSpawn === true) {
        const colonisedPlanets = observableArray("aic_colonised_planets");
        const previousUnitCount = observableArray("aic_previous_units");
        const previousPlanetStatus = observableArray("aic_planet_statuses");
        const previousImportantPlanetStatus = observableArray(
          "aic_important_planet_statuses"
        );
        const alliedAdvancedReported = observableArray("aic_ally_t2_check");
        const alliedOrbitalReported = observableArray("aic_ally_orbital_check");
        processedLanding(false);
        communicatedLanding(false);
        colonisedPlanets([]);
        previousPlanetStatus([]);
        previousImportantPlanetStatus([]);
        previousUnitCount([]);
        alliedAdvancedReported([]);
        alliedOrbitalReported([]);
      }
    };
    detectNewGame(player);

    const randomPercentageAdjustment = function (min, max) {
      return Math.random() * (max - min) + min;
    };

    const generateInterval = function () {
      const baseInterval = 10000; // 10 seconds
      return baseInterval * randomPercentageAdjustment(0.8, 1.2);
    };

    var checksInitialised = false;

    const initialiseChecks = function (allies) {
      if (checksInitialised || _.isEmpty(allies)) {
        return;
      }

      checksInitialised = true;

      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/colony.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/invasion.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/tech.js",
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/report.js",
      ], function (colony, invasion, tech, report) {
        const alliedT2CheckInterval = [];
        const alliedOrbitalCheckInterval = [];
        const alliedCatalystCheckInterval = [];

        allies.forEach(function (ally, i) {
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
          alliedCatalystCheckInterval[i] = setInterval(
            tech.alliedCatalystCheck,
            generateInterval(),
            aiAllyArmyIndex,
            ally,
            i,
            alliedCatalystCheckInterval
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
      const startingPlanetsCount = _.filter(planets, {
        starting_planet: true,
      }).length;
      const playerHasAllies = !_.isEmpty(aiAllies);
      const playerSelectingSpawn = player.landing;

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
        const defeated = payload[0];
        const killer = payload[1];
        const killerIsAI = killer && players[killer.index].ai === 1;
        const defeatedIsAIAlly =
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
