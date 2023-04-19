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

        var identifyFriendAndFoe = function (allAis) {
          console.log("Identifying friend and foe");
          if (!_.isEmpty(allAis)) {
            console.log("Setting up friend and foe");
            allAis.forEach(function (ai) {
              console.log("Processing AI", ai);
              var aiIndex = _.findIndex(model.players(), ai);
              ai.stateToPlayer === allyState
                ? aiAllyArmyIndex.push(aiIndex)
                : aiEnemyArmyIndex.push(aiIndex);
            });
          }
        };
        identifyFriendAndFoe(ais);

        var detectNewGame = function () {
          console.log("Checking for new game");
          var playerSelectingSpawn = model.player().landing;
          if (processedLanding() === true && playerSelectingSpawn === true) {
            console.log("New game found");
            processedLanding(false);
          }
        };
        detectNewGame();

        var checkPlanetsForUnits = function (desiredUnits, aiIndex) {
          console.log("Checking for units", desiredUnits, aiIndex);
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
                  console.log("Units on planet", unitsOnPlanet);
                  var unitsMatchedOnPlanet = 0;
                  desiredUnits.forEach(function (desiredUnit) {
                    console.log("Desired unit", desiredUnit);
                    for (var unit in unitsOnPlanet) {
                      console.log("Checking unit", unit);
                      if (unit === desiredUnit) {
                        unitsMatchedOnPlanet++;
                        console.log(
                          "Unit found. Matches now:",
                          unitsMatchedOnPlanet
                        );
                        break;
                      }
                    }
                  });
                  if (unitsMatchedOnPlanet === desiredUnits.length) {
                    console.log("All units found for planet", n);
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
          console.log("Sending message", translatedMessage);
          api.Panel.message(liveGameChatPanelId, "chat_message", {
            type: audience, // "team" or "global"
            player_name: aiName,
            message: translatedMessage,
          });
        };

        var communicateLandingLocation = function () {
          console.log("Checking for landing locations");
          aiAllies.forEach(function (ally, i) {
            checkPlanetsForUnits([ally.commanders[0]], aiAllyArmyIndex[i]).then(
              function (planetsWithUnit) {
                console.log("Planets with Commanders", planetsWithUnit);
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
          console.log("model.players() has updated");
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
            console.log("I haven't processed landings yet");
            processedLanding(true);
            _.delay(communicateLandingLocation, 10000); // delay to allow AI to spawn
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
