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
        var processedLanding = ko
          .observable(false)
          .extend({ session: "ai_chat_processed_landing" });
        var ally = "allied_eco";
        // model variables may not be populated yet
        var planets = model.planetListState().planets.length - 1;
        var ais = _.filter(model.players(), { ai: 1 });
        var aiAllies = _.filter(ais, { stateToPlayer: ally });
        console.log("Start state", ais, aiAllies, planets);

        var identifyFriendAndFoe = function (allAis) {
          console.log("AIs present", allAis);
          allAis.forEach(function (ai) {
            var aiIndex = _.findIndex(model.players(), ai);
            ai.stateToPlayer === ally
              ? aiAllyArmyIndex.push(aiIndex)
              : aiEnemyArmyIndex.push(aiIndex);
          });
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

        _.defer(function () {
          liveGameChatPanelId = _.find(api.panelsById, {
            src: "coui://ui/main/game/live_game/live_game_chat.html",
          }).id;
        });

        var checkPlanetsForUnit = function (desiredUnit, aiIndex) {
          console.log("Checking for unit", desiredUnit);
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
                      console.log("Unit found at", planets, n);
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
          console.log("Sending message", audience, aiName, message);
          api.Panel.message(liveGameChatPanelId, "chat_message", {
            type: audience, // "team" or "global"
            player_name: aiName,
            message: message,
          });
        };

        var communicateLandingLocation = function () {
          console.log("Communicating landing");
          processedLanding(true);
          aiAllies.forEach(function (ally, i) {
            checkPlanetsForUnit(ally.commanders[0], aiAllyArmyIndex[i]).then(
              function (aiPlanets) {
                aiPlanets.forEach(function (aiPlanet) {
                  sendMessage(
                    "team",
                    ally.name,
                    _.sample(messages.landing) +
                      model.planetListState().planets[aiPlanet].name
                  );
                });
              }
            );
          });
        };

        // model.players() isn't populated yet when this script runs
        // neither is model.planetListState() but it updates earlier
        model.players.subscribe(function () {
          console.log("model.players() updated", model.players());
          ais = _.filter(model.players(), { ai: 1 });
          aiAllies = _.filter(ais, { stateToPlayer: ally });
          //TODO - we need to detect planets which spawn later
          planets = model.planetListState().planets.length - 1; // last entry in array isn't a planet
          var startingPlanets = _.filter(model.planetListState().planets, {
            starting_planet: true,
          }).length;
          var playerHasAllies = !_.isEmpty(aiAllies);
          var playerSelectingSpawn = model.player().landing;
          console.log("Player selecting spawn", model.player().landing);
          console.log("Processed landing start state", processedLanding());

          detectNewGame();
          identifyFriendAndFoe(ais);

          if (
            startingPlanets > 1 &&
            playerHasAllies &&
            !playerSelectingSpawn &&
            !processedLanding()
          ) {
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
