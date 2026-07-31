// Shared by the ally milestone announcements and the enemy warnings so the two
// cannot drift apart.
//
// Matching is by substring against unit spec paths, so each entry has to be
// specific enough not to catch the thing that counters it. The Bugs entries
// were resolved against that mod's published unit list rather than guessed at
// from the vanilla names
define({
  nuke: [
    "land/nuke_launcher", // anchored so it cannot match anti_nuke_launcher
    "bug_nuke", // Bugs
  ],
  unitCannon: ["unit_cannon"], // the Bugs ship no equivalent
  halley: [
    "delta_v_engine",
    "bug_halley", // Bugs
  ],
  catalyst: [
    "control_module",
    "bug_catalyst", // Bugs
  ],
  // named individually - "titan" alone also matches the tutorial commander
  titan: [
    "titan_bot",
    "titan_vehicle",
    "titan_air",
    "titan_orbital",
    "titan_structure",
    // Bugs
    "bug_titan",
    "bug_air_titan",
    "bug_laser_spider",
    "bug_matriarch",
    "bug_rag",
  ],
});
