var aiReportingLoaded;

if (!aiReportingLoaded) {
  aiReportingLoaded = true;

  function aiReporting() {
    try {
      model.chatLog.subscribe(function (chatLog) {
        var reportString = "Report";
        var latestMessage = chatLog[chatLog.length - 1].message;
        var reportRequested = latestMessage.localeCompare(reportString, "en", {
          sensitivity: "base",
          ignorePunctuation: true,
        });
        if (reportRequested === 0 /* true */) {
          console.log("Reporting in!");
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiReporting();
}
