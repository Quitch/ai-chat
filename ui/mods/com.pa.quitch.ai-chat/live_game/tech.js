define([
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/chat.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/units.js",
  "coui://ui/mods/com.pa.quitch.ai-chat/live_game/superweapons.js",
], function (chat, units, superweapons) {
  var observableArray = function (string) {
    return ko.observableArray().extend({ session: string });
  };
  var milestones = [
    {
      desiredUnits: [
        "_adv",
        "advanced", // Bugs
      ],
      // Legion's basic heavy turret is named as though it were advanced
      ignoredUnits: ["t1_turret_adv"],
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

  var isRecorded = function (milestone, allyIndex) {
    return _.isBoolean(milestone.reported()[allyIndex]);
  };

  var recordMilestone = function (allyIndex, milestone, reached) {
    milestone.reported()[allyIndex] = reached;
    milestone.reported.valueHasMutated();
  };

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

      if (_.isEmpty(outstanding)) {
        return;
      }

      var desiredUnitCount = 1;
      var sets = outstanding.map(function (milestone) {
        return {
          desiredUnits: milestone.desiredUnits,
          desiredUnitCount: desiredUnitCount,
          ignoredUnits: milestone.ignoredUnits,
        };
      });

      var armyIndex = aiAllyArmyIndex[allyIndex];
      Promise.all([
        units.checkForDesiredSets(armyIndex, sets),
        units.countAll([armyIndex]),
      ])
        .then(function (results) {
          var planetsWithUnit = results[0];
          // the first lookups of a loaded save come back before the planets
          // have loaded
          var armyFound = _.some(results[1], function (planetCounts) {
            return planetCounts[0] > 0;
          });

          outstanding.forEach(function (milestone, i) {
            var reached = !_.isEmpty(planetsWithUnit[i][0]);

            if (!isRecorded(milestone, allyIndex)) {
              if (armyFound) {
                recordMilestone(allyIndex, milestone, reached);
              }
              return;
            }

            if (reached) {
              reportMilestone(ally, allyIndex, milestone);
            }
          });
        })
        .catch(units.reportCheckFailure);
    },
  };
});
