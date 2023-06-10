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
        var planets = model.planetListState().planets;
        var planetName =
          (planets[planetIndex] && planets[planetIndex].name) || "";
        var translatedMessage = loc(_.sample(messages[type]));
        var finalMessage = translatedMessage + " " + planetName;
        api.Panel.message(liveGameChatPanelId, "chat_message", {
          type: audience, // "team" or "global"
          player_name: aiName,
          message: finalMessage,
        });
      });
    },
  };
});
