define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
], function (chat, units) {
  var commanderPlanets = ko
    .observableArray()
    .extend({ session: "aic_enemy_commander_planets" });

  var lastFailureLogged = 0;

  var reportCheckFailure = function (e) {
    var now = Date.now();
    if (now - lastFailureLogged < 5000) {
      return;
    }

    lastFailureLogged = now;
    console.error(e);
    console.error("AI Chat: " + ((e && (e.stack || e.message)) || e));
  };

  var livingArmies = function (armyIndex) {
    var players = model.players();
    return _.filter(armyIndex, function (index) {
      return players[index] && !players[index].defeated;
    });
  };

  var reportSightings = function (ally, armyIndex, currentPlanets) {
    var previousPlanets = commanderPlanets()[armyIndex];
    var message = _.isUndefined(previousPlanets)
      ? "enemyCommanderSighted"
      : "enemyCommanderMoved";
    var enemy = { enemy: model.players()[armyIndex].name };

    currentPlanets.forEach(function (planetIndex) {
      if (!_.includes(previousPlanets, planetIndex)) {
        chat.send("team", ally.name, message, planetIndex, enemy);
      }
    });

    commanderPlanets()[armyIndex] = currentPlanets;
    commanderPlanets.valueHasMutated();
  };

  return {
    check: function (enemyArmyIndex, aiAllies) {
      var liveAllies = _.filter(aiAllies, { defeated: false });

      if (_.isEmpty(liveAllies)) {
        return;
      }

      livingArmies(enemyArmyIndex).forEach(function (armyIndex) {
        units
          .findUnitPlanets(armyIndex, model.players()[armyIndex].commanders)
          .then(function (currentPlanets) {
            // the lookup only lists units the team can see
            if (_.isEmpty(currentPlanets)) {
              return;
            }

            reportSightings(
              _.shuffle(liveAllies)[0],
              armyIndex,
              currentPlanets
            );
          })
          .catch(reportCheckFailure);
      });
    },
  };
});
