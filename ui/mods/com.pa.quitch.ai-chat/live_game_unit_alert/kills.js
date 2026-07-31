var aiKillsLoaded;

function aiKills() {
  if (aiKillsLoaded) {
    return;
  }

  aiKillsLoaded = true;

  try {
    // the alerts are a rolling six second window, and both adding and
    // expiring one notifies, so only the newest is ever new to us
    var lastAlert = null;

    model.defeatedArmyAlerts.subscribe(function (alerts) {
      var newestAlert = alerts[alerts.length - 1];

      if (!newestAlert || newestAlert === lastAlert) {
        return;
      }

      lastAlert = newestAlert;
      api.Panel.message(api.Panel.parentId, "kills", [
        newestAlert.defeated,
        newestAlert.killer,
      ]);
    });
  } catch (e) {
    console.error(e);
    console.error(JSON.stringify(e));
  }
}
aiKills();
