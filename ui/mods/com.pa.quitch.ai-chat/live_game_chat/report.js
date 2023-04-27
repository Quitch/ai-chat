var aiReportingLoaded;

if (!aiReportingLoaded) {
  aiReportingLoaded = true;

  function aiReporting() {
    try {
      model.chatLog.subscribe(function (chatLog) {
        console.log("CHAT SUB FIRED!");
        var reportString = "Report";
        var latestChat = chatLog[chatLog.length - 1];
        var latestMessage = latestChat.message;
        var isTeamMessage = latestChat.type === "team";
        var reportRequested = latestMessage.localeCompare(reportString, "en", {
          sensitivity: "base",
          ignorePunctuation: true,
        });
        if (reportRequested === 0 /* true */ && isTeamMessage) {
          console.log("Reporting in!");
          api.Panel.message(api.Panel.parentId, "reportIn");
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiReporting();
}
