var aiReportingLoaded;

function aiReporting() {
  if (aiReportingLoaded) {
    return;
  }

  aiReportingLoaded = true;

  try {
    model.chatLog.subscribe(function (chatLog) {
      const reportString = "Report";
      const latestChat = chatLog[chatLog.length - 1];
      const latestMessage = latestChat.message;
      const isTeamMessage = latestChat.type === "team";
      const reportRequested = latestMessage.localeCompare(reportString, "en", {
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
