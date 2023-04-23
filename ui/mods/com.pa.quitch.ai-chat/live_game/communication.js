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
        var processedLanding = ko
          .observable(false)
          .extend({ session: "ai_chat_processed_landing" });
        var allyState = "allied_eco";
        // model variables may not be populated yet
        var planets = model.planetListState().planets;
        var planetCount = planets.length - 1; // last planet is not a planet
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

        var checkForExcludedUnits = function (unitsOnPlanet, excludedUnits) {
          if (!excludedUnits) {
            return false;
          }

          for (var excludedUnit of excludedUnits) {
            for (var unit in unitsOnPlanet) {
              var excludedUnitPresent = _.includes(unit, excludedUnit);
              if (excludedUnitPresent) {
                return true;
              }
            }
          }
          return false;
        };

        var checkForDesiredUnits = function (unitsOnPlanet, desiredUnits) {
          var desiredUnitsPresent = 0;
          desiredUnits.forEach(function (desiredUnit) {
            for (var unit in unitsOnPlanet) {
              var desiredUnitOnPlanet = _.includes(unit, desiredUnit);
              if (desiredUnitOnPlanet) {
                desiredUnitsPresent++;
                break;
              }
            }
          });
          return desiredUnitsPresent;
        };

        var checkPlanetsForUnits = function (
          aiIndex,
          desiredUnits,
          desiredUnitCount,
          excludedUnits
        ) {
          if (!_.isArray(desiredUnits)) {
            desiredUnits = [desiredUnits];
          }

          var deferred = $.Deferred();
          var deferredQueue = [];
          var results = [];

          _.times(planetCount, function (planetIndex) {
            deferredQueue.push(
              api
                .getWorldView()
                .getArmyUnits(aiIndex, planetIndex)
                .then(function (unitsOnPlanet) {
                  var excludedUnitsOnPlanet = checkForExcludedUnits(
                    unitsOnPlanet,
                    excludedUnits
                  );

                  if (excludedUnitsOnPlanet) {
                    return;
                  }

                  var desiredUnitsOnPlanet = checkForDesiredUnits(
                    unitsOnPlanet,
                    desiredUnits
                  );

                  if (desiredUnitsOnPlanet >= desiredUnitCount) {
                    results.push(planetIndex);
                  }
                })
            );
          });

          Promise.all(deferredQueue).then(function () {
            deferred.resolve(results);
          });

          return deferred.promise();
        };

        var liveGameChatPanelId = 1;
        _.defer(function () {
          liveGameChatPanelId = _.find(api.panelsById, {
            src: "coui://ui/main/game/live_game/live_game_chat.html",
          }).id;
        });

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
            checkPlanetsForUnits(
              aiAllyArmyIndex[i],
              ally.commanders,
              ally.commanders.length
            ).then(function (planetsWithUnit) {
              if (_.isEmpty(planetsWithUnit)) {
                return;
              }

              planetsWithUnit.forEach(function (planetIndex) {
                sendMessage(
                  "team",
                  ally.name,
                  _.sample(messages.landing),
                  planets[planetIndex].name
                );
              });
            });
          });
        };

        var currentlyColonisedPlanets = [];

        var colonisingPlanet = function (ally, i) {
          var desiredUnits = ["lander", "teleporter", "fabrication"];
          var excludedUnits = ["factory"];
          checkPlanetsForUnits(
            aiAllyArmyIndex[i],
            desiredUnits,
            desiredUnits.length - 1, // we only need lander or teleporter
            excludedUnits
          ).then(function (planetsWithUnit) {
            if (_.isEmpty(planetsWithUnit)) {
              currentlyColonisedPlanets[i] = [];
              return;
            }

            if (_.isUndefined(currentlyColonisedPlanets[i])) {
              currentlyColonisedPlanets[i] = [];
            }

            // remove planets which are not longer reported as colonised - this allows for future messages
            currentlyColonisedPlanets[i] = _.intersection(
              currentlyColonisedPlanets[i],
              planetsWithUnit
            );

            var newPlanets = _.filter(
              planetsWithUnit,
              function (planetWithUnit) {
                return !_.includes(
                  currentlyColonisedPlanets[i],
                  planetWithUnit
                );
              }
            );

            newPlanets.forEach(function (planetIndex) {
              sendMessage(
                "team",
                ally.name,
                _.sample(messages.colonise),
                planets[planetIndex].name
              );
            });

            currentlyColonisedPlanets[i] =
              currentlyColonisedPlanets[i].concat(newPlanets);
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
              setInterval(colonisingPlanet, 10000, ally, i);
            });
          }
        };
        initialiseChecks();

        model.players.subscribe(function () {
          // model isn't always populated when these variables were first declared
          ais = _.filter(model.players(), { ai: 1 });
          aiAllies = _.filter(ais, { stateToPlayer: allyState });
          planetCount = model.planetListState().planets.length - 1; // last entry in array isn't a planet
          planets = model.planetListState().planets;
          var startingPlanetsCount = _.filter(planets, {
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

        // We need to detect planets which spawn later
        model.planetListState.subscribe(function () {
          planets = model.planetListState().planets;
          planetCount = planets.length - 1; // last entry in array isn't a planet
        });
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
