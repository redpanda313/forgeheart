# ForgeHeart on Roblox — agent-executed migration

**Status:** In progress. Slice 0 and the workshop through waking Elias live in `roblox/`. The place file builds in CI. Publishing onto the private Forge Heart place waits until Roblox is not holding the place open. This plan supersedes the 2026-07-16 tutorial-only note.  
**Product:** ForgeHeart: Gift of the Brass Gods (this repo).  
**Goal:** A published Roblox experience of the game that exists today: workshop story, sky-market training, then the home sky city.  
**Who builds it:** The agent writes, tests, and uploads the Roblox game. You handle the account gates Roblox will only accept from a person.

The browser game stays the live design lab. Roblox is a second client on the same design, built in this repo under `roblox/`.

---

## What you do

Four gates. Everything else in this document is agent work.

| Gate | When | What you do | Time |
|------|------|-------------|------|
| **G1. Account** | Before the first playable build | A Roblox account that is allowed to publish (email verified, 13+). Create one empty Experience named **ForgeHeart** in [Creator Hub](https://create.roblox.com/). Leave it private. | Once, about 10 minutes |
| **G2. Publish key** | Same day as G1 | Creator Hub → your Experience → Open Cloud → API key with `universe-places:write` on that universe. Put the key in the agent secret store, never in git. Send the **universe id** and **start place id**. | Once, about 5 minutes |
| **G3. Playtest notes** | End of each slice below | Join the private place, play the new slice, reply with what felt wrong. | About 10 minutes per slice |
| **G4. Go public** | When a slice is good enough to share | Fill Roblox’s experience questionnaire (description, genre, age). Flip the experience from private to public. | Once, when you want players |

You do not install Studio, model in Studio, write Luau, or build UI. If a later slice needs a custom sound or image, you upload that one asset from Creator Hub (Roblox ties uploads to the account) and paste the asset id back.

---

## Locked choices for the port

These are the defaults the build will follow. Say so if one of them should change before G1.

1. **One Experience, three Places.** Workshop → Brass Market → Sky City. A teleport moves you forward. Each Place is a file this repo builds.
2. **Third person.** Default Roblox camera and avatar. Shift-lock is enough for combat. A first-person mode can come after the city is fun.
3. **Your progress is yours.** DataStores keyed by Roblox `UserId` replace the browser account server and the three local save slots. Friends in the same server are visible. Wallets, plots, and crews stay per player until a later shared-market slice.
4. **The world is code.** Platforms, rooms, stalls, and homes are Parts spawned from the same layout numbers as the TypeScript builders. The brass-block look of the browser game is the v1 art. No mesh pipeline.
5. **Scale.** `1` browser unit = `4` studs (`STUD_PER_UNIT`). The browser player is 1.6 units tall; at this scale that is 6.4 studs, close to a Roblox avatar. Jump height, doors, and pads all go through that one constant.
6. **Story stays bloodless.** Brother’s death, souls in frames, and demon-eyed scrap stay non-graphic. Relationship play on Roblox is gifts, affinity, and a household upgrade. The experience questionnaire should be answered for that tone (expect 9+ or 13+).
7. **Money later.** The first public version is free with no Game Passes. Convenience cosmetics (Elias eyes, stall trim, skiff skins) wait until the city loop is real.
8. **Skip for v1.** Sky raceway, in-world city editor, Aether, patents, shared-economy PvP, and the custom Node account/multiplayer servers. Roblox identity and Roblox networking replace those servers.

---

## Why this is an agent job

The browser game is about 56,000 lines. Most of the *look* is boxes with numbers, and most of the *game* is pure rules with no Three.js in them. Those two facts are the port.

| Kind of code | Examples | What happens |
|--------------|----------|----------------|
| Rules with no rendering | `laborMarket.ts`, `marketSim.ts`, `frameAssembly.ts`, `romanceGen.ts`, `backstory.ts`, `sim/mode.ts`, the inventory and recipe half of `economy.ts` | Translated to Luau. A small Node script dumps golden JSON from the TypeScript functions. Luau tests must match those numbers. |
| Layout with box meshes | `level.ts`, `marketHub.ts`, `skyCity.ts`, `homeBuild.ts`, `stallBuild.ts`, `factoryBuild.ts`, `plazaPlots.ts` | Same coordinates, emitted as `Part`s at `STUD_PER_UNIT`. |
| Session glue | `game.ts` (~15,000 lines), `main.ts`, `styles.css`, `audio.ts`, `mobileInput.ts` | Rebuilt as small Roblox services and `ScreenGui`s. This file is not translated line by line. |
| Browser-only servers | `tools/account-server.mjs`, `tools/mp-server.mjs`, `accounts.ts`, `mpClient.ts` | Replaced by DataStores and normal Roblox replication. |

Combat damage, brass, leases, reprogram results, and door/boat wins are decided on the server. The client plays animation, sound, and prompts.

---

## Repo layout

```
roblox/
  default.project.json          Rojo: three places + shared libraries
  foreman.toml                  rojo, selene, stylua, lune, wally pins
  src/
    shared/                     configs, economy rules, remotes, scale
    server/                     authority, DataStores, NPC, world spawn
    client/                     input, HUD, camera, prompts
    places/
      workshop/                 start place
      market/
      skycity/
  tests/                        Lune tests against golden JSON
tools/roblox/
  dump-golden.mjs               runs TypeScript rules, writes tests/golden/
.github/workflows/roblox.yml    lint, lune test, rojo build, upload .rbxl
```

Toolchain, all installed by the agent on the dev machine and in CI:

- **Rojo** builds a `.rbxl` from the files above.
- **Lune** runs the rule tests with no Studio.
- **Selene** and **StyLua** lint and format.
- **Open Cloud** uploads that `.rbxl` onto the private place when G2 is done.

`rojo build` is the proof a slice exists. A green Lune run is the proof the economy still matches the browser game.

---

## Architecture

```
ReplicatedStorage.ForgeHeart.Shared    rules, catalogs, scale, remote names
ServerScriptService                     world build, sim tick, combat, saves
StarterPlayerScripts                    HUD, prompts, tool input
Workspace                               spawned Parts only (maps are not hand-built)
DataStoreService                        one profile per UserId
```

Server modules, one job each:

| Module | Owns |
|--------|------|
| `ProfileService` | Load/save the economy blob. Schema starts from `ForgeSaveData` in `save.ts`. |
| `WorldService` | Spawn a place from a layout module. StreamingEnabled on. |
| `TutorialService` | Workshop beats: explore, wake, siege, breach, escape. |
| `CombatService` | Integrity, scramble, ally plasma, wrench, hand, rogue repair. |
| `EconomyService` | Inventory mutations. Calls shared rule modules. Never trusts client quantities. |
| `CityService` | Neighbors, plots, soft goals, labor snapshot. |
| `TransitService` | Teleport to the next place with the profile already saved. |

Remotes are a closed list in `shared/remotes.lua` (`RequestInteract`, `RequestCraft`, `RequestHire`, `RequestBuild`, `RequestReprogram`, …). Each one checks distance, rate, and that the player owns the target.

---

## Slices

Each slice ends published to the **private** experience (after G2) and waits on G3 before the next slice starts. Order is the play order, so there is always a game to open.

### Slice 0 — The project builds

Agent only. No Roblox account yet.

- `roblox/` Rojo tree, formatter, linter, Lune hello-test, CI workflow.
- `STUD_PER_UNIT` and a `Part` helper (size, color, material, anchored).
- `rojo build` emits `roblox/build/ForgeHeart.rbxl`.

**Done when:** CI is green and the place file opens onto an empty brass platform.

### Slice 1 — Workshop (first thing friends can play)

Maps from `level.ts` `buildBrotherWorkshop` and the tutorial in `docs/FORGEHEART_DESIGN.md`.

1. Spawn in the two-story workshop. Walk, jump, stairs.
2. Read the photo and the journal (`ProximityPrompt`).
3. Elias on the bench, disabled. Hand reprogram wakes him.
4. Scrap path still exists: break the frame, pick up 3 trays, rebuild.
5. Siege: 10 bangs, door gives, wrench on the rack.
6. Two hostile frames. Integrity / scramble / ally follow, server-side, with the numbers from `robot.ts` (`ROBOT` table).
7. Exterior dock. Board the boat. Win writes `tutorial_done` and offers the market teleport.

HUD: health, plasma, objective line, interact prompt. Audio: Roblox library stingers until you upload a track.

**Done when:** A new player finishes the workshop with no guide. Profile reloads at the win screen after rejoin.

**You:** G1 and G2 before upload. G3 after.

### Slice 2 — Brass Market training

The loop that already ships in the browser: harvest, craft, hire, sell, earn the apartment.

Ported rules, with golden tests first:

- Commodity catalog and starter inventory (`emptyInventory`, 40 brass).
- Harvest sites and success (`applyHarvestSuccess`, deposit layout).
- Craft recipes used by the training bay.
- Frame slots (`frameAssembly.ts`).
- Hire, wages, one robot worker, Elias as crew (`ensureEliasRobotWorker`).
- Stall price and the demand multipliers in `marketSim.ts`.
- `buyApartment` gate (1,000 brass spent at the east real-estate desk).

World from `marketHub.ts`: pads, vendors, reef entrance, bay, broker, real-estate desk. Harvest is a short server minigame on a separate pad (the same timing rules, Roblox UI). Surfboard is a vehicle seat with the browser board’s forward speed, trimmed until it feels good in your G3 notes.

**Done when:** A new profile can go from empty bay to apartment deed, and Lune matches the TypeScript golden files for every rule touched.

### Slice 3 — Sky City, solo

Home district from `skyCity.ts` and the SP plan in `docs/SKY_CITY_SP_PLAN.md`.

- Arrive at the apartment. Neighbor speaks once.
- Residential plaza, grand market, industrial lease pads, sky lanes.
- Same inventory, now with a city workshop lease.
- Plot grid: buy, build from `PLOT_BUILD_CATALOG`, upkeep tick (bay, rent, land tax) using the same intervals as `economy.ts`.
- Neighbors on the city clock (commute, work, market, home). Shoppers can buy from your stall.
- Work robots. A rare rogue state, repaired with the hand for brass.
- Soft-goal coach line on the HUD (`softGoalObjectiveLine`).

Population stays modest (dozens of simple humanoids, not hundreds). `StreamingEnabled` and a cap on active NPC rigs keep a phone able to join.

**Done when:** Apartment → meet neighbor → lease a workshop → place one building → survive an upkeep tick without the brass math drifting from the golden files.

### Slice 4 — Other players in the city

- Same Sky City place, up to 32 players (the design target).
- Avatars, names, and a light presence (which pad you are on).
- Profiles stay private. No stealing, no shared wallet.
- Co-op workshop visits are follow-along: the host’s tutorial flags advance; a friend can fight and carry trays.

**Done when:** Two accounts see each other, each keeps their own brass, and a rejoin restores both.

### Slice 5 — Public

Agent prepares, you confirm with G4.

- Icon and thumbnail images generated for you to upload (or uploaded with the API key if the key’s scopes allow assets).
- Experience description, genre, and the age answers written out so you can paste them.
- A one-page `PLAY` note for Roblox: click Play, new game is automatic, objectives sit on the left.
- Private place stays up. Public flip is yours.

**Done when:** The experience page is public and a logged-out alt can finish the workshop.

---

## Rule modules, in the order they get golden tests

The big file is `economy.ts` (~9,800 lines). It is ported by behavior, not copied.

| Order | Browser source | First consumer |
|------:|----------------|----------------|
| 1 | `sim/mode.ts`, save blob in `save.ts` | Slice 1 profile |
| 2 | `robot.ts` `ROBOT` constants and phase changes | Slice 1 combat |
| 3 | Commodity list, `emptyInventory`, craft costs | Slice 2 |
| 4 | `frameAssembly.ts` | Slice 2 broker |
| 5 | `marketSim.ts`, `laborMarket.ts` | Slice 2 stall, Slice 3 housing |
| 6 | Harvest, hire, `buyApartment`, bay upkeep | Slice 2 |
| 7 | `backstory.ts`, `romanceGen.ts` (gift + affinity only) | Slice 3 |
| 8 | `neighborLife.ts`, plot quotes, soft goals | Slice 3 |
| 9 | Factory layouts, stall tiers, home tiers | After Slice 3 feels good |

`dump-golden.mjs` imports the real TypeScript and writes JSON. When a browser rule changes, CI fails the Luau test until the port catches up. That is how the two games stay one design.

---

## Combat and tutorial numbers to keep

Taken from the current design, implemented in `CombatService`:

- Arc hit: ~24 integrity, ~28 scramble. Repair ~14 integrity/s.
- Rapid hits disable. Spaced hits fill scramble, eyes go dark, hand reprograms a still-standing frame.
- Close fuse ~2.6 s, blast ~3.2 m (×4 studs). Leaving the radius cancels it.
- Spark bolt about every 4 s, slow turn, dodgeable.
- At most 3 plasma allies. Each drains ~3.2 plasma/s. At 0 plasma the furthest ally turns hostile after ~2.8 s.
- Siege: 10 bangs, 3 seconds apart, then the door is gone.

---

## Save shape

Version field starts at `1`, same idea as `ForgeSaveData`.

```
profile = {
  version, tutorialPhase, levelId,
  health, plasma,
  economy = { brass, aether, items, workers, recipes, plots, neighborLife, softGoals, ... }
}
```

Unknown keys are kept and ignored, so an older server does not wipe a newer profile. Autosave on a timer, on teleport, and on `PlayerRemoving`.

The saved `spawn` checkpoint only moves forward: workshop until the skiff, brass market after cast-off, sky city once the apartment deed is owned. Death and rejoin use that pad. A ferry ride back to the training yard does not move it backward, and the shared workshop siege does not overwrite a player who has already left.

---

## Place map (studs)

Layouts are lifted from the builders, then multiplied by `STUD_PER_UNIT`.

| Place | Source layout | Player starts |
|-------|----------------|---------------|
| Workshop | `buildBrotherWorkshop` | Floor of the lab |
| Brass Market | `buildMarketHub` | Ferry dock |
| Sky City | `buildSkyCity` | Apartment pad (`apartmentAnchorXZ`) |

Collision groups: `World`, `Player`, `NPC`, `Board`. Boards do not collide with the player that owns them.

---

## Publishing loop

```
edit Luau
  → lune tests
  → rojo build roblox/build/ForgeHeart.rbxl
  → Open Cloud place version (private)
  → you play G3
  → next slice
```

CI does the first three on every push to the Roblox branch. Upload runs only when the API key secret is present, and only for the private place. Public (G4) is never done from CI.

---

## Content bar for Roblox

Written to pass a normal Roblox review while keeping the story:

- No blood, no gore, no corpse detail. A disabled frame kneels and the eyes go dark.
- Elias’s death is told by a photograph and a journal line.
- Gifts and affinity can add a room to the apartment. Dialogue stays friendly and specific. No sexual content, no dating pressure, no real-money romance.
- Players use their own Roblox avatar. The game does not force a body type.
- Brass is earned in play. Nothing in v1 is sold for Robux.

---

## Risks the slices already account for

| Risk | What the slice does about it |
|------|------------------------------|
| Phone performance in the city | Slice 3 caps NPC rigs and uses streaming. Slice 0’s platform is the baseline. |
| Economy drift from the browser game | Golden JSON. A mismatch fails CI. |
| Exploits on remotes | Server checks distance, ownership, and amounts. Client never sends a new brass total. |
| Story stuck in multiplayer | Slice 1 and 2 are completable alone. Slice 4 adds friends without sharing wallets. |
| Ally stuck on a dock | Simple move-toward with a teleport-to-player rescue if stuck for a few seconds. PathfindingService comes after that rescue exists. |
| Open Cloud key missing | Slices still build `.rbxl` in CI. Upload waits on G2. You can also open the file locally; you never have to. |

---

## First actions the moment you say go

1. Add `roblox/` and the CI workflow (Slice 0) and land it on `main`.
2. Dump golden JSON for the `ROBOT` table and `emptyInventory`.
3. Build the workshop blockout from `level.ts` and the tutorial service (Slice 1) up to “Elias wakes.”
4. Hand you the exact G1/G2 clicks, then upload as soon as the key exists.

Until you say go, the browser game on `main` is unchanged.
