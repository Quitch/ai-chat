var aiChatMessagesLoaded;

if (!aiChatMessagesLoaded) {
  aiChatMessagesLoaded = true;

  function aiChatMessages() {
    try {
      var sendMessagesToChat = function (messages) {
        _.forEach(messages, function (message) {
          handlers.chat_message({
            type: message.audience,
            message: message.contents,
            player_name: message.name,
          });
        });
      };

      var processMessageQueue = function () {
        var messages = ko
          .observableArray()
          .extend({ local: "ai_message_queue" });
        sendMessagesToChat(messages());
        messages.splice(0, messages().length);
      };

      // Listen for messages to send
      // TODO - replace this hack with event handlers
      window.addEventListener("storage", function (e) {
        if (e.key === "ai_message_queue") {
          _.delay(processMessageQueue, 1000); // avoids repeat messages when several sent at once
        }
      });
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiChatMessages();
}
