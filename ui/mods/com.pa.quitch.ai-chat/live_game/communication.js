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
          if (!_.isEmpty(allAis)) {
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
                if (_.isEmpty(planetsWithUnit)) {
                  return;
                }

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

        var colonisedPlanets = [];

        var colonisingPlanet = function (ally, index) {
          //var faction = determineFaction(ally);
          //var unit = determineUnit(faction, "teleporter");
          var units = [
            "/pa/units/land/teleporter/teleporter.json",
            "/pa/units/land/fabrication_bot/fabrication_bot.json",
          ];
          checkPlanetsForUnits(units, aiAllyArmyIndex[index]).then(function (
            planetsWithUnit
          ) {
            if (_.isEmpty(planetsWithUnit)) {
              return;
            }

            // avoid repeat notifications while still notifying for replacement teleporters
            // TODO - prevent notification for planets with base presences
            if (_.isUndefined(colonisedPlanets[index])) {
              colonisedPlanets[index] = [];
            }

            var newPlanets = _.filter(
              planetsWithUnit,
              function (planetWithUnit) {
                return !_.includes(colonisedPlanets[index], planetWithUnit);
              }
            );
            colonisedPlanets[index] =
              colonisedPlanets[index].concat(newPlanets);

            newPlanets.forEach(function (planetIndex) {
              sendMessage(
                "team",
                ally.name,
                _.sample(messages.colonise),
                model.planetListState().planets[planetIndex].name
              );
            });
          });
        };

        var checksInitialised = false;

        var initialiseChecks = function () {
          if (checksInitialised) {
            return;
          }

          if (!_.isEmpty(aiAllies)) {
            checksInitialised = true;

            aiAllies.forEach(function (ally, i) {
              setInterval(colonisingPlanet, 5000, ally, i);
            });
          }
        };
        initialiseChecks();

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
          initialiseChecks();

          if (
            startingPlanetsCount > 1 &&
            playerHasAllies &&
            !playerSelectingSpawn &&
            !processedLanding()
          ) {
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
