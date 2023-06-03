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
      var allyState = "allied_eco";
      var enemyState = "hostile";
      // model variables may not be populated yet
      var planets = model.planetListState().planets;
      var planetCount = planets.length - 1; // last planet is not a planet
      var players = model.players();
      var ais = _.filter(players, { ai: 1 });
      var aiAllies = _.filter(ais, { stateToPlayer: allyState });
      var enemies = _.filter(players, { stateToPlayer: enemyState });

      var liveGameChatPanelId = 1;
      _.defer(function () {
        liveGameChatPanelId = _.find(api.panelsById, {
          src: "coui://ui/main/game/live_game/live_game_chat.html",
        }).id;
      });

      var sendMessage = function (audience, aiName, type, planetIndex) {
        require([
          "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
        ], function (messages) {
          var planetName =
            (planets[planetIndex] && planets[planetIndex].name) || "";
          var translatedMessage = loc(_.sample(messages[type]));
          var finalMessage = translatedMessage + " " + planetName;
          api.Panel.message(liveGameChatPanelId, "chat_message", {
            type: audience, // "team" or "global"
            player_name: aiName,
            message: finalMessage,
          });
        });
      };

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
          aisIndex.forEach(function (aiIndex) {
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
        var winningRatio = 4;
        var losingRatio = 1.5;
        var situationReports = [];

        alliedUnitsPerPlanet.forEach(function (alliedUnits, planetIndex) {
          var enemyUnits = enemyUnitsPerPlanet[planetIndex];
          if (alliedUnits === 0) {
            situationReports.push("absent");
          } else if (enemyUnits === 0) {
            situationReports.push("alone");
          } else if (alliedUnits >= enemyUnits * winningRatio) {
            situationReports.push("winning");
          } else if (alliedUnits <= enemyUnits * losingRatio) {
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

      var previousPlanetStatus = ko
        .observableArray()
        .extend({ session: "ai_chat_planet_statuses" });
      var previousImportantPlanetStatus = ko
        .observableArray()
        .extend({ session: "ai_chat_important_planet_statuses" });

      var checkIfWorthReporting = function (planetIndex, report) {
        var importantStatus = new Set();
        importantStatus.add("winning");
        importantStatus.add("losing");

        if (
          previousPlanetStatus()[planetIndex] === "ok" && // avoid swingy reporting
          report !== previousImportantPlanetStatus()[planetIndex] &&
          importantStatus.has(report) // to avoid report spam
        ) {
          previousImportantPlanetStatus()[planetIndex] = report;
          previousImportantPlanetStatus.valueHasMutated();
          return true;
        }

        return false;
      };

      var reportIn = function (playerRequested) {
        var liveAllies = _.filter(aiAllies, { defeated: false });

        if (_.isEmpty(liveAllies)) {
          return;
        }

        var allAIIndex = aiAllyArmyIndex.concat(enemyArmyIndex);
        countAllUnitsOnPlanets(allAIIndex).then(function (planetUnitCounts) {
          var situationReports = getSituationReports(planetUnitCounts);
          var ally = _.shuffle(liveAllies)[0];
          situationReports.forEach(function (report, planetIndex) {
            if (report === "absent") {
              previousPlanetStatus()[planetIndex] = report;
              previousPlanetStatus.valueHasMutated();
              return;
            }

            var worthReporting = checkIfWorthReporting(planetIndex, report);

            if (playerRequested === true || worthReporting === true) {
              sendMessage("team", ally.name, report, planetIndex);
            }

            previousPlanetStatus()[planetIndex] = report;
            previousPlanetStatus.valueHasMutated();
          });
        });
      };

      handlers.reportIn = function () {
        reportIn(true);
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
        if (!_.isArray(desiredUnits)) {
          desiredUnits = [desiredUnits];
        }

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

            matchedPlanets.forEach(function (planetIndex) {
              sendMessage("team", ally.name, "landing", planetIndex);
            });
          });
        });
      };

      var currentlyColonisedPlanets = ko
        .observableArray()
        .extend({ session: "ai_chat_colonised_planets" });

      var sendLostPlanetMessage = function (ally, lostPlanets) {
        lostPlanets.forEach(function (planetIndex) {
          sendMessage("team", ally.name, "planetLost", planetIndex);
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
        newPlanets.forEach(function (planetIndex) {
          sendMessage("team", ally.name, "colonise", planetIndex);
        });
      };

      var checkForPlanetsWeColonised = function (
        ally,
        allyIndex,
        matchedPlanets,
        excludedPlanets
      ) {
        // remove planets which are no longer reported as colonised - this allows for future messages
        currentlyColonisedPlanets()[allyIndex] = _.intersection(
          currentlyColonisedPlanets()[allyIndex],
          matchedPlanets
        ).concat(excludedPlanets);

        var newPlanets = _.filter(matchedPlanets, function (matchedPlanet) {
          return !_.includes(
            currentlyColonisedPlanets()[allyIndex],
            matchedPlanet
          );
        });

        sendColonisedMessage(ally, newPlanets);

        currentlyColonisedPlanets()[allyIndex] =
          currentlyColonisedPlanets()[allyIndex].concat(newPlanets);
        currentlyColonisedPlanets.valueHasMutated();
      };

      var checkForColonies = function (ally, allyIndex) {
        var desiredUnits = [
          "lander",
          "teleporter",
          "fabrication",
          "mining_platform",
          "commander",
        ];
        var desiredUnitCount = 2; // we only need a fabber and something else
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

          if (_.isUndefined(currentlyColonisedPlanets()[allyIndex])) {
            currentlyColonisedPlanets()[allyIndex] = [];
          }

          checkForPlanetsWeLost(
            ally,
            currentlyColonisedPlanets()[allyIndex],
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

      var alliedAdvancedTechCheckInterval = [];
      var alliedAdvancedTechReported = ko
        .observableArray()
        .extend({ session: "ai_chat_ally_t2_check" });

      var checkForAlliedAdvancedTech = function (ally, allyIndex) {
        var desiredUnits = ["_adv"];
        var desiredUnitCount = 1;
        checkPlanetsForDesiredUnits(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        ).then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          clearInterval(alliedAdvancedTechCheckInterval[allyIndex]);

          if (alliedAdvancedTechReported()[allyIndex] === true) {
            return;
          }

          sendMessage("team", ally.name, "allyAdvTech");
          alliedAdvancedTechReported()[allyIndex] = true;
          alliedAdvancedTechReported.valueHasMutated();
        });
      };

      var alliedOrbitalTechCheckInterval = [];
      var alliedOrbitalTechReported = ko
        .observableArray()
        .extend({ session: "ai_chat_ally_orbital_check" });

      var checkForAlliedOrbitalTech = function (ally, allyIndex) {
        var desiredUnits = ["orbital_"];
        var desiredUnitCount = 1;
        checkPlanetsForDesiredUnits(
          aiAllyArmyIndex[allyIndex],
          desiredUnits,
          desiredUnitCount
        ).then(function (planetsWithUnit) {
          var matchedPlanets = planetsWithUnit[0];

          if (_.isEmpty(matchedPlanets)) {
            return;
          }

          clearInterval(alliedOrbitalTechCheckInterval[allyIndex]);

          if (alliedOrbitalTechReported()[allyIndex] === true) {
            return;
          }

          sendMessage("team", ally.name, "allyOrbitalTech");
          alliedOrbitalTechReported()[allyIndex] = true;
          alliedOrbitalTechReported.valueHasMutated();
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

      var previousUnitCount = ko
        .observableArray()
        .extend({ session: "ai_chat_previous_unit_count" });

      var identifyNewlyInvadedPlanets = function (
        allyIndex,
        perPlanetUnitCounts
      ) {
        if (_.isUndefined(previousUnitCount()[allyIndex])) {
          previousUnitCount()[allyIndex] = _.range(0, planetCount, 0);
        }

        var newPlanets = [];

        perPlanetUnitCounts.forEach(function (planetUnitCount, planetIndex) {
          var armySizeMultiplier = 1.5;
          // avoid multiplying by zero
          var unitCount = Math.max(
            previousUnitCount()[allyIndex][planetIndex],
            1
          );
          if (
            planetUnitCount > unitCount * armySizeMultiplier &&
            planetUnitCount > 20
          ) {
            newPlanets.push(planetIndex);
          }

          previousUnitCount()[allyIndex][planetIndex] = planetUnitCount;
          previousUnitCount.valueHasMutated();
        });

        return newPlanets;
      };

      var communicateAnyInvasions = function (ally, newlyInvadedPlanets) {
        newlyInvadedPlanets.forEach(function (planetIndex) {
          sendMessage("team", ally.name, "invasion", planetIndex);
        });
      };

      var checkForInvasions = function (ally, allyIndex) {
        var desiredUnits = ["bot", "tank", "orbital_"];
        countDesiredUnitsOnPlanets(
          aiAllyArmyIndex[allyIndex],
          desiredUnits
        ).then(function (perPlanetUnitCounts) {
          var newlyInvadedPlanets = identifyNewlyInvadedPlanets(
            allyIndex,
            perPlanetUnitCounts
          );

          // we don't check this first because identifyNewlyInvadedPlanets()
          // has to update the previous unit count
          var planetsPresentOn = 0;
          perPlanetUnitCounts.forEach(function (planetUnitCount) {
            if (planetUnitCount > 0) {
              planetsPresentOn++;
            }
          });
          if (planetsPresentOn < 2) {
            return;
          }

          communicateAnyInvasions(ally, newlyInvadedPlanets);
        });
      };

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
          processedLanding(false);
          currentlyColonisedPlanets([]);
          previousPlanetStatus([]);
          previousImportantPlanetStatus([]);
          previousUnitCount([]);
          alliedAdvancedTechReported([]);
          alliedOrbitalTechReported([]);
        }
      };
      detectNewGame(model.player());

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

        allies.forEach(function (ally, i) {
          if (planetCount > 1) {
            setInterval(checkForColonies, generateInterval(), ally, i);
            setInterval(checkForInvasions, generateInterval(), ally, i);
            alliedAdvancedTechCheckInterval[i] = setInterval(
              checkForAlliedAdvancedTech,
              generateInterval(),
              ally,
              i
            );
            alliedOrbitalTechCheckInterval[i] = setInterval(
              checkForAlliedOrbitalTech,
              generateInterval(),
              ally,
              i
            );
            setInterval(reportIn, generateInterval());
          }
        });
      };
      initialiseChecks(aiAllies);

      model.players.subscribe(function () {
        players = model.players();
        var player = model.player();
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

      handlers.kills = function (payload) {
        var defeated = payload[0];
        var killer = payload[1];
        var killerIsAI = players[killer.index].ai === 1;
        var defeatedIsAIAlly =
          players[defeated.index].ai === 1 &&
          players[defeated.index].stateToPlayer === allyState;

        if (killerIsAI) {
          sendMessage("global", killer.name, "kill");
        }

        if (defeatedIsAIAlly) {
          sendMessage("team", defeated.name, "defeat");
        }
      };
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
