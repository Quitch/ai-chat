var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var aiAllyArmyIndex = [];
      var aiEnemyArmyIndex = [];
      var processedLanding = ko
        .observable(false)
        .extend({ session: "ai_chat_processed_landing" });
      var allyState = "allied_eco";
      // model variables may not be populated yet
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet
      var players = model.players();
      var ais = _.filter(players, { ai: 1 });
      var aiAllies = _.filter(ais, { stateToPlayer: allyState });

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

      var identifyFriendAndFoe = function (allAis, allPlayers) {
        // avoid duplicates if this is called more than once
        aiAllyArmyIndex = [];
        aiEnemyArmyIndex = [];
        if (!_.isEmpty(allAis)) {
          allAis.forEach(function (ai) {
            var aiIndex = _.findIndex(allPlayers, ai);
            ai.stateToPlayer === allyState
              ? aiAllyArmyIndex.push(aiIndex)
              : aiEnemyArmyIndex.push(aiIndex);
          });
        }
      };
      identifyFriendAndFoe(ais, players);

      var detectNewGame = function (player) {
        var playerSelectingSpawn = player.landing;
        if (processedLanding() === true && playerSelectingSpawn === true) {
          processedLanding(false);
        }
      };
      detectNewGame(model.player());

      var countAllUnits = function (unitsOnPlanet) {
        var unitCount = 0;
        for (var unit in unitsOnPlanet) {
          unitCount += unitsOnPlanet[unit].length;
        }
        return unitCount;
      };

      var countAllUnitsOnPlanets = function (aisIndex) {
        var deferred = $.Deferred();
        var deferredQueue = [];
        var unitCount = [];

        _.times(planetCount, function (planetIndex) {
          _.times(aisIndex.length, function (aiIndex) {
            deferredQueue.push(
              api
                .getWorldView()
                .getArmyUnits(aiIndex, planetIndex)
                .then(function (unitsOnPlanet) {
                  var unitCountOnPlanet = countAllUnits(unitsOnPlanet);
                  if (_.isUndefined(unitCount[planetIndex])) {
                    unitCount[planetIndex] = [];
                  }
                  unitCount[planetIndex].push(unitCountOnPlanet);
                })
            );
          });
        });

        Promise.all(deferredQueue).then(function () {
          deferred.resolve(unitCount);
        });

        return deferred.promise();
      };

      var separateFriendFromFoe = function (planetUnitCounts) {
        var alliedUnitsPerPlanet = [];
        var enemyUnitsPerPlanet = [];
        var playerIndex = _.findIndex(model.players(), {
          stateToPlayer: "self",
        });
        var allyIndex = _.findIndex(model.players(), {
          stateToPlayer: "allied_eco",
        });
        var teamIndex = Math.min(playerIndex, allyIndex);
        var allyCount = aiAllyArmyIndex.length;

        planetUnitCounts.forEach(function (planetUnitCount) {
          var unitsPerAlly = planetUnitCount.splice(teamIndex, allyCount + 1);
          var unitsPerEnemy = planetUnitCount;
          var alliedUnits = unitsPerAlly.reduce(function (
            accumulator,
            currentValue
          ) {
            return accumulator + currentValue;
          });
          var enemyUnits = unitsPerEnemy.reduce(function (
            accumulator,
            currentValue
          ) {
            return accumulator + currentValue;
          });
          alliedUnitsPerPlanet.push(alliedUnits);
          enemyUnitsPerPlanet.push(enemyUnits);
        });

        return {
          allies: alliedUnitsPerPlanet,
          enemies: enemyUnitsPerPlanet,
        };
      };

      var compareArmySizes = function (
        alliedUnitsPerPlanet,
        enemyUnitsPerPlanet
      ) {
        var winningRatio = 1.5;
        var losingRatio = 0.75;
        var situationReports = [];

        alliedUnitsPerPlanet.forEach(function (alliedUnits, i) {
          if (alliedUnits === 0) {
            situationReports.push("absent");
          } else if (alliedUnits >= enemyUnitsPerPlanet[i] * winningRatio) {
            situationReports.push("winning");
          } else if (alliedUnits <= enemyUnitsPerPlanet * losingRatio) {
            situationReports.push("losing");
          } else {
            situationReports.push("ok");
          }
        });

        return situationReports;
      };

      var getSituationReports = function (planetUnitCounts) {
        var friendAndFoe = separateFriendFromFoe(planetUnitCounts);
        var alliedUnitsPerPlanet = friendAndFoe.allies;
        var enemyUnitsPerPlanet = friendAndFoe.enemies;
        var situationReports = compareArmySizes(
          alliedUnitsPerPlanet,
          enemyUnitsPerPlanet
        );
        return situationReports;
      };

      handlers.reportIn = function () {
        if (_.isEmpty(aiAllyArmyIndex)) {
          return;
        }

        var allAIIndex = aiAllyArmyIndex.concat(aiEnemyArmyIndex);
        countAllUnitsOnPlanets(allAIIndex).then(function (planetUnitCounts) {
          var situationReports = getSituationReports(planetUnitCounts);
          var ally = _.shuffle(aiAllies)[0];

          require([
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
          ], function (messages) {
            situationReports.forEach(function (situationReport, planetIndex) {
              switch (situationReport) {
                case "winning":
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.winning),
                    planets[planetIndex].name
                  );
                  break;
                case "losing":
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.losing),
                    planets[planetIndex].name
                  );
                  break;
                case "ok":
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.ok),
                    planets[planetIndex].name
                  );
                // default: no presence on planet - keep the noise to a minimum
              }
            });
          });
        });
      };

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

      var countDesiredUnits = function (unitsOnPlanet, desiredUnits) {
        var desiredUnitsCount = 0;
        desiredUnits.forEach(function (desiredUnit) {
          for (var unit in unitsOnPlanet) {
            if (_.includes(unit, desiredUnit)) {
              desiredUnitsCount += unitsOnPlanet[unit].length;
            }
          }
        });
        return desiredUnitsCount;
      };

      var countDesiredUnitsOnPlanets = function (aiIndex, desiredUnits) {
        var deferred = $.Deferred();
        var deferredQueue = [];
        var desiredUnitCount = [];

        _.times(planetCount, function (planetIndex) {
          deferredQueue.push(
            api
              .getWorldView()
              .getArmyUnits(aiIndex, planetIndex)
              .then(function (unitsOnPlanet) {
                var desiredUnitsOnPlanet = countDesiredUnits(
                  unitsOnPlanet,
                  desiredUnits
                );
                desiredUnitCount.push(desiredUnitsOnPlanet);
              })
          );
        });

        Promise.all(deferredQueue).then(function () {
          deferred.resolve(desiredUnitCount);
        });

        return deferred.promise();
      };

      var previousUnitCount = [];

      var identifyNewlyInvadedPlanets = function (
        allyIndex,
        perPlanetUnitCounts
      ) {
        if (_.isUndefined(previousUnitCount[allyIndex])) {
          previousUnitCount[allyIndex] = [];
          _.times(planetCount, function () {
            previousUnitCount[allyIndex].push(0);
          });
        }

        var newPlanets = [];

        perPlanetUnitCounts.forEach(function (planetUnitCount, planetIndex) {
          var armySizeMultiplier = 5;
          // avoid multiplying by zero
          var unitCount = Math.max(
            previousUnitCount[allyIndex][planetIndex],
            1
          );
          if (planetUnitCount >= unitCount * armySizeMultiplier) {
            newPlanets.push(planetIndex);
          }

          previousUnitCount[allyIndex][planetIndex] = planetUnitCount;
        });

        return newPlanets;
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

            require([
              "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
            ], function (messages) {
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
        });
      };

      var currentlyColonisedPlanets = [];

      var colonisingPlanet = function (ally, i) {
        var desiredUnits = [
          "lander",
          "teleporter",
          "fabrication",
          "mining_platform",
        ];
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

          var newPlanets = _.filter(planetsWithUnit, function (planetWithUnit) {
            return !_.includes(currentlyColonisedPlanets[i], planetWithUnit);
          });

          require([
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
          ], function (messages) {
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
        });
      };

      var invadingPlanet = function (ally, allyIndex) {
        var desiredUnits = ["bot", "tank", "orbital_"];
        countDesiredUnitsOnPlanets(
          aiAllyArmyIndex[allyIndex],
          desiredUnits
        ).then(function (perPlanetUnitCounts) {
          var newlyInvadedPlanets = identifyNewlyInvadedPlanets(
            allyIndex,
            perPlanetUnitCounts
          );

          require([
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
          ], function (messages) {
            newlyInvadedPlanets.forEach(function (planetIndex) {
              sendMessage(
                "team",
                ally.name,
                _.sample(messages.invasion),
                planets[planetIndex].name
              );
            });
          });
        });
      };

      var checksInitialised = false;

      var initialiseChecks = function (allies) {
        if (checksInitialised) {
          return;
        }

        if (!_.isEmpty(allies)) {
          checksInitialised = true;

          allies.forEach(function (ally, i) {
            if (planetCount > 1) {
              setInterval(colonisingPlanet, 10000, ally, i);
              setInterval(invadingPlanet, 10000, ally, i);
            }
          });
        }
      };
      initialiseChecks(aiAllies);

      model.players.subscribe(function () {
        // model isn't always populated when these variables were first declared
        players = model.players();
        var player = model.player();
        ais = _.filter(players, { ai: 1 });
        aiAllies = _.filter(ais, { stateToPlayer: allyState });
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
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
