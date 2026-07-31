# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI Chat is a **client-side mod** for Planetary Annihilation: TITANS that makes AI players talk in the in-game chat — landing announcements, colonisation, invasions, tech milestones, per-planet situation reports on demand, and taunts on a kill. It ships to the Steam Workshop as a ZIP; there is no build step, no bundler, and no test harness. The game loads the JS directly at launch.

The checkout lives in the PA user data directory (`client_mods/ai-chat`). The game install is a second workspace folder and has its own `CLAUDE.md` covering base-game layout, shadowing, and the Coherent UI engine — read it before looking anything up in `pa/`, `pa_ex1/`, or stock `ui/main/`.

Note `modinfo.json` declares identifier `com.pa.quitch.ai-chat-dev` / display name "AI Chat DEV" so this working copy coexists with the Workshop install, but the `ui/` tree and every `coui://` path inside it use the release identifier `com.pa.quitch.ai-chat`. That mismatch is intentional — do not "fix" it.

## Commands

No build. Verification is loading PA with the mod enabled and starting a game against AI allies.

```sh
npx eslint .                      # lint (config in eslint.config.mjs)
npx prettier --check .            # format check
npx prettier --write .            # format
npx markdownlint "**/*.md" --ignore node_modules   # docs; markdownlint is not a local dep
```

eslint is clean as of `82a37f1`, so any error you see is yours. Two caveats on the other two:

- Prettier still reports pre-existing drift in 7 files under `ui/`, so a clean format check is not the bar — compare against the baseline before and after your change.
- Prettier's default `endOfLine: "lf"` fights `.gitattributes` (`* text=auto`, so the working tree is CRLF on Windows) and flags every file. Pass `--end-of-line crlf` to see only the real drift.

## The Chrome 40 constraint

The game's Coherent UI runs Chromium 40. `var` only — **no `const`/`let`**, no arrow functions, no template literals, no `class`, no `Object.assign`/`Array.from`, no `String.prototype.startsWith`/`endsWith`. `for...of`, `Promise`, `Set`, `Map` and generators do work. `_` (lodash 3.9.3), `$`, `ko`, `model`, `api`, `loc` and `handlers` are globals.

[eslint.config.mjs](eslint.config.mjs) is the authoritative answer to "may I use X?" and each rule carries the Chrome version and the reasoning behind it. `es-x/restrict-to-es5` bans everything post-ES5; the whitelist block re-enables only what Chrome 40 shipped. If a feature is not in that whitelist, it is not available. Read the comments there before adding an exception.

## Architecture

### Entry points and module loading

`modinfo.json` `scenes` registers one script per game scene. Those three files ([live_game/communication.js](ui/mods/com.pa.quitch.ai-chat/live_game/communication.js), [live_game_chat/report.js](ui/mods/com.pa.quitch.ai-chat/live_game_chat/report.js), [live_game_unit_alert/kills.js](ui/mods/com.pa.quitch.ai-chat/live_game_unit_alert/kills.js)) are **plain scripts, not AMD modules**, and each follows the same shape: a `var <name>Loaded` global guard, a function wrapping everything in `try…catch` that logs both `e` and `JSON.stringify(e)`. The guard matters because a scene can re-run its scripts on UI reload — without it, intervals and subscriptions would stack up. Every other file is an AMD `define()` module pulled in by absolute `coui://ui/mods/com.pa.quitch.ai-chat/…` path. Scene scripts share one JS namespace with stock UI code, so top-level names must stay distinctive.

### Cross-panel messaging

Scenes are separate panels and cannot see each other's state directly. Both directions go through `api.Panel.message`:

- **Child → parent**: `live_game_chat` and `live_game_unit_alert` each subscribe to a knockout model they can see (`model.chatLog`, `model.defeatedArmyAlerts`), decide almost nothing, and forward to `api.Panel.message(api.Panel.parentId, "<name>", payload)`. `live_game/communication.js` receives them as `handlers.<name>` (`handlers.reportIn`, `handlers.kills`) and owns all the logic.
- **Parent → chat panel**: [live_game/chat.js](ui/mods/com.pa.quitch.ai-chat/live_game/chat.js) is the only thing that speaks. It resolves the chat panel's id once via `_.find(api.panelsById, {src: ".../live_game_chat.html"})` inside a `_.defer` (the panel is not registered yet at script-eval time), then posts `chat_message` with `type` of `"team"` or `"global"` and the AI's name as `player_name`.

Adding a new trigger that lives in another scene means: a new scene entry in `modinfo.json`, a new guarded script that forwards, and a matching `handlers.<name>` in `communication.js`.

### Polling and one-shot checks

There is no event for "the AI built a thing", so `initialiseChecks` in `communication.js` fans out `setInterval` timers per ally, one per feature module. Intervals come from `generateInterval()` — 10s jittered ±20% — specifically so several allies do not all speak on the same tick. Colony and invasion checks only run when there is more than one planet.

Checks that should fire **once** (tech milestones) are passed the array holding their own interval handle and call `clearInterval(interval[allyIndex])` themselves once the condition is met; see `reportTechStatus` in [live_game/tech.js](ui/mods/com.pa.quitch.ai-chat/live_game/tech.js). Recurring checks (colony, invasion, report) never clear.

### Persistent state across UI reloads

Anything that must survive a UI refresh mid-game is a knockout observable extended with `session`:

```js
ko.observableArray().extend({ session: "aic_colonised_planets" });
```

The session key **is** the identity — modules re-declare the same observable with the same key rather than passing state around, so `aic_ally_t2_check` in `tech.js` and in `communication.js` are the same store. All keys use the `aic_` prefix. Two consequences:

- Mutating an element in place (`arr()[i] = x`) does not notify; every such write is followed by `arr.valueHasMutated()`.
- Session state outlives the game, so `detectNewGame()` in `communication.js` explicitly resets every key when it sees the player return to landing state. **A new session key must be added to that reset list**, or stale state leaks into the next match.

### Unit detection

[live_game/units.js](ui/mods/com.pa.quitch.ai-chat/live_game/units.js) is the sole wrapper over `api.getWorldView().getArmyUnits(armyIndex, planetIndex)` and exposes three shapes: `countAll` (per planet, per army), `countDesired` (count of matching units per planet), `checkForDesired` (returns `[matchedPlanets, rejectedPlanets]` given desired units, a minimum distinct-match count, and optional excluded units). Everything is **substring matching against unit spec paths** via `_.includes` — `"_adv"`, `"orbital_"`, `"control_module"`. Feature modules pass literal fragments; there is no unit registry.

Two recurring gotchas:

- `model.planetListState().planets` has a trailing entry that is not a planet, so planet counts are always `planets.length - 1`. Every loop over planets repeats this.
- The Bugs faction names things differently, so most desired-unit lists carry a parallel entry (`"advanced"`, `"bug_jig"`, `"_fab"`, `"land/bug_"`, `"_hive"`) marked with a `// Bugs` comment. New unit checks need the Bugs equivalent too.

Army indices are not player indices: `identifyFriendAndFoe` builds `aiAllyArmyIndex` / `enemyArmyIndex` by `_.findIndex(model.players(), …)` and those arrays are threaded through every check. `communication.js` rebuilds them on each `model.players` change, since a player leaving reorders the list.

### Situation reports

[live_game/report.js](ui/mods/com.pa.quitch.ai-chat/live_game/report.js) totals units per planet, splits ally from enemy, and buckets each planet into `absent` / `alone` / `winning` / `losing` / `ok` by ratio (deliberately pessimistic: 4× to claim winning, 1.5× to admit losing, because the AI has imperfect information). The same function serves both the on-demand path (`playerRequested === true`, triggered by typing "report" in team chat) and the automatic one, where `checkIfWorthReporting` suppresses everything except an `ok` → `winning`/`losing` transition that differs from the last important status. That two-observable dance (`aic_planet_statuses` plus `aic_important_planet_statuses`) exists to stop a planet flip-flopping into chat spam — preserve it when touching the reporting rules.

### Messages

[live_game/messages.js](ui/mods/com.pa.quitch.ai-chat/live_game/messages.js) is a flat map of type key → array of strings; `chat.send(audience, aiName, type, planetIndex)` picks one with `_.sample`, runs it through `loc()`, and **appends the planet name**. So every entry in a planet-scoped category must be phrased to read correctly with a planet name tacked on the end ("Settling the planet of", "Purging"). Categories without a planet (`kill`, `defeat`, `allyAdvTech`, `allyOrbitalTech`, `allyCatalystTech`) are complete sentences. Strings are prefixed `!LOC:` for the localisation system; emoticons are not.

Adding a message type means an entry in `messages.js` plus a `chat.send(…, "<key>")` call — the key is the only link between them, and a typo fails silently as an empty message.

## Conventions

[CONTRIBUTING.md](CONTRIBUTING.md) holds the full list. The ones that bite:

- Two-space indent, camelCase, all lint warnings resolved before commit. SonarLint complexity limits are waived for the function wrapping a file's `try…catch`.
- No file shadowing unless unavoidable — this mod deliberately adds only its own files under `ui/mods/`.
- A pull request changes only what the request needs; clean-up and reformatting go in separate commits.
- Commit summaries are imperative and concise ("Report Catalyst construction"), with detail in the body.
- Update the `## Unreleased` section of [CHANGELOG.md](CHANGELOG.md) in the same commit as a user-visible change.

## Releasing

The version appears in three places and they must agree: `version` in [modinfo.json](modinfo.json), `sonar.projectVersion` in [.sonarcloud.properties](.sonarcloud.properties), and the heading in [CHANGELOG.md](CHANGELOG.md). Also bump `date` (and `build`, the PA build the release was tested against) in `modinfo.json`. [.gitattributes](.gitattributes) `export-ignore` entries keep dev files out of the distributed archive — anything new that is tooling-only belongs on that list.
