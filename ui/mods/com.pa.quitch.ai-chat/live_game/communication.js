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
        var aiCount = aisIndex.length;

        _.times(planetCount, function (planetIndex) {
          _.times(aiCount, function (aiIndex) {
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
          var alliedUnits = unitsPerAlly.reduce(function (acc, val) {
            return acc + val;
          });
          var enemyUnits = unitsPerEnemy.reduce(function (acc, val) {
            return acc + val;
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
        var winningRatio = 5;
        var losingRatio = 1.5;
        var situationReports = [];

        alliedUnitsPerPlanet.forEach(function (alliedUnits, i) {
          var enemyUnits = enemyUnitsPerPlanet[i];
          if (alliedUnits === 0) {
            situationReports.push("absent");
          } else if (enemyUnits === 0) {
            situationReports.push("alone");
          } else if (alliedUnits >= enemyUnitsPerPlanet[i] * winningRatio) {
            situationReports.push("winning");
          } else if (alliedUnits <= enemyUnitsPerPlanet[i] * losingRatio) {
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
        var liveAllies = _.filter(aiAllies, { defeated: false });

        if (_.isEmpty(aiAllyArmyIndex) || _.isEmpty(liveAllies)) {
          return;
        }

        var allAIIndex = aiAllyArmyIndex.concat(aiEnemyArmyIndex);
        countAllUnitsOnPlanets(allAIIndex).then(function (planetUnitCounts) {
          require([
            "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
          ], function (messages) {
            var situationReports = getSituationReports(planetUnitCounts);
            var ally = _.shuffle(liveAllies)[0];
            situationReports.forEach(function (report, planetIndex) {
              if (report === "absent") {
                return;
              }

              sendMessage(
                "team",
                ally.name,
                _.sample(messages[report]),
                planets[planetIndex].name
              );
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

      var checkPlanetsForDesiredUnits = function (
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
        var matches = [];
        var rejections = [];

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
                  rejections.push(planetIndex);
                  return;
                }

                var desiredUnitsOnPlanet = checkForDesiredUnits(
                  unitsOnPlanet,
                  desiredUnits
                );

                if (desiredUnitsOnPlanet >= desiredUnitCount) {
                  matches.push(planetIndex);
                }
              })
          );
        });

        Promise.all(deferredQueue).then(function () {
          deferred.resolve([matches, rejections]);
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
          checkPlanetsForDesiredUnits(
            aiAllyArmyIndex[i],
            ally.commanders,
            ally.commanders.length
          ).then(function (planetsWithUnit) {
            var matchedPlanets = planetsWithUnit[0];

            if (_.isEmpty(matchedPlanets)) {
              return;
            }

            require([
              "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
            ], function (messages) {
              matchedPlanets.forEach(function (planetIndex) {
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

      var sendLostPlanetMessage = function (ally, lostPlanets) {
        require([
          "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
        ], function (messages) {
          lostPlanets.forEach(function (planetIndex) {
            sendMessage(
              "team",
              ally.name,
              _.sample(messages.planetLost),
              planets[planetIndex].name
            );
          });
        });
      };

      var checkForPlanetsWeLost = function (
        ally,
        ourPastPlanets,
        matchedPlanets,
        excludedPlanets
      ) {
        var ourCurrentPlanets = matchedPlanets.concat(excludedPlanets);
        var lostPlanets = _.filter(ourPastPlanets, function (planet) {
          return !_.includes(ourCurrentPlanets, planet);
        });

        if (_.isEmpty(lostPlanets)) {
          return;
        }

        sendLostPlanetMessage(ally, lostPlanets);
      };

      var sendColonisedMessage = function (ally, newPlanets) {
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
        });
      };

      var checkForPlanetsWeColonised = function (
        ally,
        allyIndex,
        matchedPlanets,
        excludedPlanets
      ) {
        // remove planets which are no longer reported as colonised - this allows for future messages
        currentlyColonisedPlanets[allyIndex] = _.intersection(
          currentlyColonisedPlanets[allyIndex],
          matchedPlanets
        ).concat(excludedPlanets);

        var newPlanets = _.filter(matchedPlanets, function (matchedPlanet) {
          return !_.includes(
            currentlyColonisedPlanets[allyIndex],
            matchedPlanet
          );
        });

        sendColonisedMessage(ally, newPlanets);

        currentlyColonisedPlanets[allyIndex] =
          currentlyColonisedPlanets[allyIndex].concat(newPlanets);
      };

      var checkForColonies = function (ally, allyIndex) {
        var desiredUnits = [
          "lander",
          "teleporter",
          "fabrication",
          "mining_platform",
        ];
        var desiredUnitCount = 2; // we only a fabber and something else
        var excludedUnits = ["factory"];
        checkPlanetsForDesiredUnits(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount,
          excludedUnits
        ).then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];
          var excludedPlanets = planetsWithUnit[1];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          if (_.isUndefined(currentlyColonisedPlanets[allyIndex])) {
            currentlyColonisedPlanets[allyIndex] = [];
          }

          checkForPlanetsWeLost(
            ally,
            currentlyColonisedPlanets[allyIndex],
            matchedPlanets,
            excludedPlanets
          );
          checkForPlanetsWeColonised(
            ally,
            allyIndex,
            matchedPlanets,
            excludedPlanets
          );
        });
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

      var communicateAnyInvasions = function (
        ally,
        allyIndex,
        perPlanetUnitCounts
      ) {
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
      };

      var checkForInvasions = function (ally, allyIndex) {
        var desiredUnits = ["bot", "tank", "orbital_"];
        countDesiredUnitsOnPlanets(
          aiAllyArmyIndex[allyIndex],
          desiredUnits
        ).then(function (perPlanetUnitCounts) {
          var planetsPresentOn = 0;
          perPlanetUnitCounts.forEach(function (planetUnitCount) {
            if (planetUnitCount > 0) {
              planetsPresentOn++;
            }
          });
          if (planetsPresentOn < 2) {
            return;
          }

          communicateAnyInvasions(ally, allyIndex, perPlanetUnitCounts);
        });
      };

      var checksInitialised = false;

      var initialiseChecks = function (allies) {
        if (checksInitialised || _.isEmpty(allies)) {
          return;
        }

        checksInitialised = true;

        allies.forEach(function (ally, i) {
          if (planetCount > 1) {
            setInterval(checkForColonies, 10000, ally, i);
            setInterval(checkForInvasions, 10000, ally, i);
          }
        });
      };
      initialiseChecks(aiAllies);

      model.players.subscribe(function () {
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
