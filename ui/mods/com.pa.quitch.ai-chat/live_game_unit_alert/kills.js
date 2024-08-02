var aiKillsLoaded;

function aiKills() {
  if (aiKillsLoaded) {
    return;
  }

  aiKillsLoaded = true;

  try {
    model.defeatedArmyAlerts.subscribe(function (alerts) {
      alerts.forEach(function (alert) {
        const defeated = alert.defeated;
        const killer = alert.killer;
        api.Panel.message(api.Panel.parentId, "kills", [defeated, killer]);
      });
    });
  } catch (e) {
    console.error(e);
    console.error(JSON.stringify(e));
  }
}
aiKills();
