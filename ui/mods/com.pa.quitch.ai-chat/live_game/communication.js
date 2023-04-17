var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
      ], function (messages) {
        var aiAllyArmyIndex = [];
        var aiEnemyArmyIndex = [];
        var setupAiIndexes = false;
        var liveGameChatPanelId = 1;
        _.defer(function () {
          liveGameChatPanelId = _.find(api.panelsById, {
            src: "coui://ui/main/game/live_game/live_game_chat.html",
          }).id;
        });
        var processedLanding = ko
          .observable(false)
          .extend({ session: "ai_chat_processed_landing" });
        var allyState = "allied_eco";
        // model variables may not be populated yet
        var planetCount = model.planetListState().planets.length - 1; // last planet is not a planet
        var ais = _.filter(model.players(), { ai: 1 });
        var aiAllies = _.filter(ais, { stateToPlayer: allyState });
        console.log("Start state", ais, aiAllies, planetCount);

        var identifyFriendAndFoe = function (allAis) {
          console.log("AIs present", allAis);
          if (!_.isEmpty(ais) && setupAiIndexes === false) {
            setupAiIndexes = true;
            allAis.forEach(function (ai) {
              var aiIndex = _.findIndex(model.players(), ai);
              ai.stateToPlayer === allyState
                ? aiAllyArmyIndex.push(aiIndex)
                : aiEnemyArmyIndex.push(aiIndex);
            });
          }
        };
        identifyFriendAndFoe(ais);

        var detectNewGame = function () {
          var playerSelectingSpawn = model.player().landing;
          if (processedLanding() === true && playerSelectingSpawn === true) {
            console.log("This is a new game");
            processedLanding(false);
          }
        };
        detectNewGame();

        var checkPlanetsForUnit = function (desiredUnit, aiIndex) {
          console.log("Checking for unit", desiredUnit);
          var deferred = $.Deferred();
          var deferredQueue = [];
          var results = [];

          _.times(planetCount, function (n) {
            deferredQueue.push(
              api
                .getWorldView()
                .getArmyUnits(aiIndex, n)
                .then(function (units) {
                  for (var unit in units) {
                    if (unit === desiredUnit) {
                      console.log("Unit found at", planetCount, n);
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

        var sendMessage = function (audience, aiName, message, planet) {
          var translatedMessage = loc(message) + " " + planet;
          console.log("Sending message", audience, aiName, translatedMessage);
          api.Panel.message(liveGameChatPanelId, "chat_message", {
            type: audience, // "team" or "global"
            player_name: aiName,
            message: translatedMessage,
          });
        };

        var communicateLandingLocation = function () {
          console.log("Communicating landing");
          aiAllies.forEach(function (ally, i) {
            checkPlanetsForUnit(ally.commanders[0], aiAllyArmyIndex[i]).then(
              function (aiPlanets) {
                aiPlanets.forEach(function (aiPlanet) {
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.landing),
                    model.planetListState().planets[aiPlanet].name
                  );
                });
              }
            );
          });
        };

        // Landing and variable set up
        model.players.subscribe(function () {
          console.log("model.players() updated", model.players());
          // model isn't always populated when this script first runs
          ais = _.filter(model.players(), { ai: 1 });
          aiAllies = _.filter(ais, { stateToPlayer: allyState });
          //TODO - we need to detect planets which spawn later
          planetCount = model.planetListState().planets.length - 1; // last entry in array isn't a planet
          var startingPlanetsCount = _.filter(model.planetListState().planets, {
            starting_planet: true,
          }).length;
          var playerHasAllies = !_.isEmpty(aiAllies);
          var playerSelectingSpawn = model.player().landing;
          console.log("Player selecting spawn", model.player().landing);
          console.log("Processed landing start state", processedLanding());

          detectNewGame();
          identifyFriendAndFoe(ais);

          if (
            startingPlanetsCount > 1 &&
            playerHasAllies &&
            !playerSelectingSpawn &&
            !processedLanding()
          ) {
            processedLanding(true);
            _.delay(communicateLandingLocation, 10000); // give AIs time to land
          }
        });
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
