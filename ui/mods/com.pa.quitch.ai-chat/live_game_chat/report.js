var aiReportingLoaded;

function aiReporting() {
  if (aiReportingLoaded) {
    return;
  }

  aiReportingLoaded = true;

  try {
    model.chatLog.subscribe(function (chatLog) {
      var reportString = "Report";
      var latestChat = chatLog[chatLog.length - 1];
      var latestMessage = latestChat.message;
      var isTeamMessage = latestChat.type === "team";
      var reportRequested = latestMessage.localeCompare(reportString, "en", {
        sensitivity: "base",
        ignorePunctuation: true,
      });
      if (reportRequested === 0 /* true */ && isTeamMessage) {
        api.Panel.message(api.Panel.parentId, "reportIn");
      }
    });
  } catch (e) {
    console.error(e);
    console.error(JSON.stringify(e));
  }
}
aiReporting();
