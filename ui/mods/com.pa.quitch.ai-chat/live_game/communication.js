var aiCommunicationsLoaded;

if (!aiCommunicationsLoaded) {
  aiCommunicationsLoaded = true;

  function aiCommunications() {
    try {
      var aiAllies = _.filter(model.players(), {
        ai: 1,
        stateToPlayer: "ally",
      });
      var aiAlliesCount = aiAllies.length;
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiCommunications();
}
