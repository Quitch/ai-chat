define(function () {
  var liveGameChatPanelId = 1;

  _.defer(function () {
    liveGameChatPanelId = _.find(api.panelsById, {
      src: "coui://ui/main/game/live_game/live_game_chat.html",
    }).id;
  });

  return {
    send: function (audience, aiName, type, planetIndex) {
      require([
        "coui://ui/mods/com.pa.quitch.ai-chat/live_game/messages.js",
      ], function (messages) {
        const planets = model.planetListState().planets;
        const planetName =
          (planets[planetIndex] && planets[planetIndex].name) || "";
        const translatedMessage = loc(_.sample(messages[type]));
        const finalMessage = translatedMessage + " " + planetName;
        api.Panel.message(liveGameChatPanelId, "chat_message", {
          type: audience, // "team" or "global"
          player_name: aiName,
          message: finalMessage,
        });
      });
    },
  };
});
