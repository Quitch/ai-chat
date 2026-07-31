# CHANGELOG

## Unreleased

- Allies warn you about enemy nukes, unit cannons, Halleys, Catalysts and Titans they have scouted
- Allies tell you when they complete a nuclear launcher, Titan or unit cannon
- Allies warn you when a planet starts moving under its own engines
- Allies warn you when an enemy fleet masses in orbit above one of your planets
- Allies warn you when the enemy reaches a planet your team holds
- Allies call for help when their army on a planet is being destroyed
- Fix Bugs allies never reporting Catalyst construction
- Fix allies staying silent about their landing location on slow-loading systems

## v1.2.2 - 2026-07-31

- Report when building a Catalyst
- Fix situation reports counting an enemy army as friendly
- Fix planets held outright reporting as okay rather than owned
- Fix checks using stale army indices after a player leaves
- Fix defeated allies continuing to issue situation reports
- Fix situation reports being duplicated when you have multiple AI allies
- Fix allies with multiple commanders not reporting their landing location
- Fix an orbital fabber alone triggering a colonisation message
- Fix Bugs gas giant colonisation never being reported
- Fix fabbers counting towards the size of an invasion force
- Fix duplicate messages when several players are defeated at once

## v1.2.1 - 2023-08-23

- Fix invalid operations in array reductions
- Fix allies not reporting their landing locations

## v1.2 - 2023-06-21

- Improved support for Bugs faction

## v1.1 - 2023-06-10

- Fixed AI not reporting tech and status changes on single planet maps

## v1.0.1 - 2023-06-04

- Fixed AIs not communicating landing locations

## v1.0 - 2023-06-03

- AI won't reset its message state on UI refresh
- Allies automatically report significant changes in planetary status
- AIs comment on their kills and defeat
- Fixed allies being blind to some enemy AIs when reporting status
- Count non-AI enemies towards assessments

## v0.7 - 2023-05-01

- Allies inform you when they start heading into T2
- Allies inform you when they start building orbital for the first time
- Variance added to AI checks to prevent all messages arriving at once

## v0.6 - 2023-04-29

- Correctly identifies Commanders and Colonels as fabbers for the purpose of colonisation checks
- Fix invasion notifications always triggering for the home planet when the AI expanded to another planet
- Improvements to how the AI detects its own invasions

## v0.5 - 2023-04-28

- Allied reports now inform you when your team is the sole presence on a planet
- Situation reports won't be issued by defeated allies
- Situation reports are more pessimistic
- Allies report when they're driven off a planet
- Fixed ally reports not reporting losing situations as intended

## v0.4 - 2023-04-27

- Allies will report the situation for your team per-planet upon request, simply send "report" in team chat
- AI more likely to call out its invasions
- AI calls out when it establishes a presence on a gas giant

## v0.3 - 2023-04-24

- Allies inform you when they're invading a planet

## v0.2 - 2023-04-20

- Fixed issue with AI allies not telling you where they landed in some circumstances
- Support an AI ally with multiple commanders landing on multiple worlds
- Allies inform you when they're colonising a new planet

## v0.1 - 2023-04-16

- AI allies will notify you which planet they landed on on multi-planet maps
