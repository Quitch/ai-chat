var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var aiAlliesCount = _.filter(model.players(), {
        ai: 1,
        stateToPlayer: "ally",
      }).length;
      var startingPlanetCount = _.filter(model.planetListState().planets, {
        starting_planet: true,
      }).length;
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
