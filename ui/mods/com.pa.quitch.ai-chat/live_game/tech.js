define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/superweapons.js",
], function (chat, units, superweapons) {
  var observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };

  // each milestone is announced once per ally per game. They share one pass
  // over the planets because they are all asking about the same army, so
  // adding one costs matching work rather than another lookup
  var milestones = [
    {
      desiredUnits: [
        "_adv",
        "advanced", // Bugs
      ],
      reported: observableArray("aic_ally_t2_check"),
      message: "allyAdvTech",
    },
    {
      desiredUnits: ["orbital_"],
      reported: observableArray("aic_ally_orbital_check"),
      message: "allyOrbitalTech",
    },
    {
      desiredUnits: superweapons.catalyst,
      reported: observableArray("aic_ally_catalyst_check"),
      message: "allyCatalystTech",
    },
    {
      desiredUnits: superweapons.nuke,
      reported: observableArray("aic_ally_nuke_check"),
      message: "allyNuke",
    },
    {
      desiredUnits: superweapons.titan,
      reported: observableArray("aic_ally_titan_check"),
      message: "allyTitan",
    },
    {
      desiredUnits: superweapons.unitCannon,
      reported: observableArray("aic_ally_unit_cannon_check"),
      message: "allyUnitCannon",
    },
  ];

  var outstandingMilestones = function (allyIndex) {
    return _.filter(milestones, function (milestone) {
      return milestone.reported()[allyIndex] !== true;
    });
  };

  var reportMilestone = function (ally, allyIndex, milestone) {
    chat.send("team", ally.name, milestone.message);
    milestone.reported()[allyIndex] = true;
    milestone.reported.valueHasMutated();
  };

  return {
    check: function (aiAllyArmyIndex, ally, allyIndex) {
      var outstanding = outstandingMilestones(allyIndex);

      // everything has been announced, so there is nothing left to look for.
      // The interval this runs on is shared with the ally's other checks, so
      // it cannot be cleared - returning here costs nothing either way
      if (_.isEmpty(outstanding)) {
        return;
      }

      var desiredUnitCount = 1;
      var sets = outstanding.map(function (milestone) {
        return {
          desiredUnits: milestone.desiredUnits,
          desiredUnitCount: desiredUnitCount,
        };
      });

      units
        .checkForDesiredSets(aiAllyArmyIndex[allyIndex], sets)
        .then(function (planetsWithUnit) {
          outstanding.forEach(function (milestone, i) {
            var matchedPlanets = planetsWithUnit[i][0];

            if (_.isEmpty(matchedPlanets)) {
              return;
            }

            reportMilestone(ally, allyIndex, milestone);
          });
        });
    },
  };
});
