define({
  nuke: [
    "land/nuke_launcher", // anchored so it cannot match anti_nuke_launcher
    "bug_nuke", // Bugs
    "land/l_nuke_launcher", // Legion, anchored so it cannot match l_anti_nuke_launcher
    "missile_facility", // Exiles
  ],
  unitCannon: ["unit_cannon"],
  halley: [
    // also matches Legion's l_delta_v_engine and Exiles' t_delta_v_engine
    "delta_v_engine",
    "bug_halley", // Bugs
  ],
  catalyst: [
    // also matches Legion's l_control_module and Exiles' t_control_module
    "control_module",
    "bug_catalyst", // Bugs
  ],
  // named individually - "titan" alone also matches the tutorial commander.
  // Legion's l_titan_* units are matched by these same fragments
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
    // Exiles
    "land/cyclone",
    "land/t_chimera",
    "mass_tele_titan",
  ],
});
