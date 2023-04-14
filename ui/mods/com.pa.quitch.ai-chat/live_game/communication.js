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
      var messages = ko.observableArray().extend({ local: "ai_message_queue" });

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

      var messageAllies = function (aiName, message) {
        messages.push({ audience: "team", name: aiName, contents: message });
      };

      var communicateLandingLocation = function () {
        aiAllies.forEach(function (ally, i) {
          checkPlanetsForUnit(ally.commanders[0], aiAllyArmyIndex[i]).then(
            function (aiPlanets) {
              aiPlanets.forEach(function (aiPlanet) {
                messageAllies(
                  ally.name,
                  "I'm on " + model.planetListState().planets[aiPlanet].name
                );
              });
            }
          );
        });
      };

      // model.players() isn't populated yet when this script runs
      // neither is model.planetListState() but it updates first
      model.players.subscribe(function () {
        var landing = model.player().landing;
        ais = _.filter(model.players(), { ai: 1 });
        aiAllies = _.filter(ais, { stateToPlayer: "allied_eco" });
        planets = model.planetListState().planets.length - 1;
        startingPlanets = _.filter(model.planetListState().planets, {
          starting_planet: true,
        }).length;
        var playerHasLanded = !model.player().landing;
        var playerHasAllies = !_.isEmpty(aiAllies);
        var processedLanding = landing ? false : true;

        ais.forEach(function (ai) {
          var aiIndex = _.findIndex(model.players(), ai);
          ai.stateToPlayer === "allied_eco"
            ? aiAllyArmyIndex.push(aiIndex)
            : aiEnemyArmyIndex.push(aiIndex);
        });

        if (
          startingPlanets > 1 &&
          playerHasLanded &&
          playerHasAllies &&
          processedLanding === true
        ) {
          processedLanding = true;
          _.delay(communicateLandingLocation, 10000);
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
