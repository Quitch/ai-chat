var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var ais = [];
      var aiAllies = [];
      var planets = 1;
      var startingPlanets = 1;
      var aiAllyArmyIndex = [];
      var aiEnemyArmyIndex = [];
      var processedLanding = ko
        .observable(false)
        .extend({ session: "ai_chat_processed_landing" });
      var liveGameChatPanelId = 1;

      _.defer(function () {
        liveGameChatPanelId = _.find(api.panelsById, {
          src: "coui://ui/main/game/live_game/live_game_chat.html",
        }).id;
      });

      var checkPlanetsForUnit = function (desiredUnit, aiIndex) {
        var deferred = $.Deferred();
        var deferredQueue = [];
        var results = [];

        _.times(planets, function (n) {
          deferredQueue.push(
            api
              .getWorldView()
              .getArmyUnits(aiIndex, n)
              .then(function (units) {
                for (var unit in units) {
                  if (unit === desiredUnit) {
                    results.push(n);
                    break;
                  }
                }
              })
          );
        });

        Promise.all(deferredQueue).then(function () {
          deferred.resolve(results);
        });

        return deferred.promise();
      };

      var sendMessage = function (audience, aiName, message) {
        api.Panel.message(liveGameChatPanelId, "chat_message", {
          type: audience, // "team" or "global"
          player_name: aiName,
          message: message,
        });
      };

      var communicateLandingLocation = function () {
        aiAllies.forEach(function (ally, i) {
          checkPlanetsForUnit(ally.commanders[0], aiAllyArmyIndex[i]).then(
            function (aiPlanets) {
              aiPlanets.forEach(function (aiPlanet) {
                sendMessage(
                  "team",
                  ally.name,
                  "I'm on " + model.planetListState().planets[aiPlanet].name
                );
              });
            }
          );
        });
      };

      // model.players() isn't populated yet when this script runs
      // neither is model.planetListState() but it updates earlier
      model.players.subscribe(function () {
        ais = _.filter(model.players(), { ai: 1 });
        aiAllies = _.filter(ais, { stateToPlayer: "allied_eco" });
        //TODO - we need to detect planets which spawn later
        planets = model.planetListState().planets.length - 1; // last entry in array isn't a planet
        startingPlanets = _.filter(model.planetListState().planets, {
          starting_planet: true,
        }).length;
        var playerHasAllies = !_.isEmpty(aiAllies);
        var playerSelectingSpawn = model.player().landing;

        // Detect a new game
        if (processedLanding() === true && playerSelectingSpawn === true) {
          processedLanding(false);
        }

        ais.forEach(function (ai) {
          var aiIndex = _.findIndex(model.players(), ai);
          ai.stateToPlayer === "allied_eco"
            ? aiAllyArmyIndex.push(aiIndex)
            : aiEnemyArmyIndex.push(aiIndex);
        });

        if (
          startingPlanets > 1 &&
          playerHasAllies &&
          !playerSelectingSpawn &&
          !processedLanding()
        ) {
          processedLanding(true);
          _.delay(communicateLandingLocation, 10000); // give AIs time to land
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
