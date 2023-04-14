var aiChatMessagesLoaded;

if (!aiChatMessagesLoaded) {
  aiChatMessagesLoaded = true;

  function aiChatMessages() {
    try {
      var aiMessage = function (payload) {
        handlers.chat_message({
          type: payload.audience,
          message: payload.message,
          player_name: payload.aiName,
        });
      };
    } catch (e) {
      console.error(e);
      console.error(JSON.stringify(e));
    }
  }
  aiChatMessages();
}
