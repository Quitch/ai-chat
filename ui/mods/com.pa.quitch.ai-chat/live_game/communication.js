var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var determineGameType = function () {
        // not a typo, PA Inc can't spell
        if (model.gameOptions.isGalaticWar()) {
          return "GW";
        } else if (model.playerInTeam()) {
          return "Teams";
        }
        return "FFA";
      };

      var ais = _.filter(model.players(), { ai: 1 });
      var aiAllies = _.filter(ais, { stateToPlayer: "allied_eco" }).length;
      var aiEnemies = _.filter(ais, { stateToPlayer: "hostile" }).length;
      var aiAlliesCount = aiAllies.length;
      var startingPlanetCount = _.filter(model.planetListState().planets, {
        starting_planet: true,
      }).length;
      var gameType = determineGameType();
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
