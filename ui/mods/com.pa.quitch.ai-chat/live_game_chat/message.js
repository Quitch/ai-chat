var aiChatMessagesLoaded;

if (!aiChatMessagesLoaded) {
  aiChatMessagesLoaded = true;

  function aiChatMessages() {
    try {
      var aiMessage = function (messages) {
        _.forEach(messages, function (message) {
          handlers.chat_message({
            type: message.audience,
            message: message.contents,
            player_name: message.name,
          });
        });
      };

      // Listen for messages to send
      window.addEventListener("storage", function (e) {
        if (e.key === "ai_message_queue") {
          var messages = ko
            .observableArray()
            .extend({ local: "ai_message_queue" });
          aiMessage(messages());
          messages([]);
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiChatMessages();
}
