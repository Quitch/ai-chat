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
        var intervals = {};

        var identifyFriendAndFoe = function (allAis) {
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
            processedLanding(false);
          }
        };
        detectNewGame();

        var checkPlanetsForUnits = function (desiredUnits, aiIndex) {
          if (!_.isArray(desiredUnits)) {
            desiredUnits = [desiredUnits];
          }

          var deferred = $.Deferred();
          var deferredQueue = [];
          var results = [];

          _.times(planetCount, function (n) {
            deferredQueue.push(
              api
                .getWorldView()
                .getArmyUnits(aiIndex, n)
                .then(function (unitsOnPlanet) {
                  var unitsMatchedOnPlanet = 0;
                  desiredUnits.forEach(function (desiredUnit) {
                    for (var unit in unitsOnPlanet) {
                      if (unit === desiredUnit) {
                        unitsMatchedOnPlanet++;
                        break;
                      }
                    }
                  });
                  console.log(
                    "Units matched",
                    n,
                    unitsMatchedOnPlanet,
                    desiredUnits.length
                  );
                  if (unitsMatchedOnPlanet === desiredUnits.length) {
                    results.push(n);
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
          api.Panel.message(liveGameChatPanelId, "chat_message", {
            type: audience, // "team" or "global"
            player_name: aiName,
            message: translatedMessage,
          });
        };

        var communicateLandingLocation = function () {
          aiAllies.forEach(function (ally, i) {
            checkPlanetsForUnits([ally.commanders[0]], aiAllyArmyIndex[i]).then(
              function (planetsWithUnit) {
                planetsWithUnit.forEach(function (planetIndex) {
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.landing),
                    model.planetListState().planets[planetIndex].name
                  );
                });
              }
            );
          });
        };

        // Landing and variable set up
        model.players.subscribe(function () {
          // model isn't always populated when these variables were first declared
          ais = _.filter(model.players(), { ai: 1 });
          aiAllies = _.filter(ais, { stateToPlayer: allyState });
          //TODO - we need to detect planets which spawn later
          planetCount = model.planetListState().planets.length - 1; // last entry in array isn't a planet
          var startingPlanetsCount = _.filter(model.planetListState().planets, {
            starting_planet: true,
          }).length;
          var playerHasAllies = !_.isEmpty(aiAllies);
          var playerSelectingSpawn = model.player().landing;

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
