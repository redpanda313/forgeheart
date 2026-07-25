# SP content freeze checklist (Task 16)

**Branch:** `feature/soft-goals-standing`  
**Scope:** Soft goals, neighbor life, plaza RE (plots / builds / shapes / layers / airways), economy sinks, onboarding.  
**Not in this freeze:** accounts, authority, multiplayer presence, Roblox, automation leftovers (Task 15).

---

## Save migrations (must stay load-safe)

| Data | Save path | Notes |
|------|-----------|--------|
| Soft goals / standing | `softGoalFlags`, `empireStanding`, `districtStanding` | Flags bootstrapped from neighbor + plot world on load |
| Neighbor life | `neighborLife` | Drama, debt, affinity, hire links |
| Plaza plots | `plazaPlots.plots[]` | owner, buildings (lx/lz/yaw/layer), shape, layer, vacant, retailBound |
| Pad placement | `padsResetV1` | One-time legacy free-move/rotate snap |
| Bridges | `bridgesClearedV1` | Bridges stripped forever |
| Airways | `plazaPlots.airways[]` | Invalid links dropped on load |
| Soft goal optional | `plantedGarden`, `boundRetail`, `lastAnnouncedGoalId` | Optional onboarding flags |

**Load rule:** unknown fields ignored; missing RE data rebuilds empty 3×3 cores via `emptyPlazaPlots` / `ensurePlazaPlots`.

---

## Economy sinks live (Task 13)

Per upkeep tick (`UPKEEP_INTERVAL`, empire city):

1. **Bay upkeep** — bay level + wages + shop tax (`tickBayUpkeep`)
2. **Landlord rents** — neighbor pads + plaza tenants (`tickAllLandlordRents`)
3. **Plot ownership** — empty-plot tax, multi-plot bureaucracy, structure/layer/shape upkeep, airway fees (`tickPlotOwnershipCosts`)

One-time sinks still apply on purchase/build/remodel/airway link.

---

## Onboarding surface (Task 14)

- Soft-goal chain in HUD objective + standing line
- City-enter toast sequence + coach line + contextual tip (~22s)
- Goal-advance toasts mid-session (`pollSoftGoalAnnouncement`)
- Periodic coach re-nudge (~75s)
- Map **PLOT** pins for leasing offices (Market + Residential)
- Optional goals: plot garden, retail bind (after first land deed)

Ferry / training market remains a practice sandbox (no dual RE there).

---

## Perf notes (light)

- Bridges removed (no mesh spam)
- Pad free-move/rotate removed (stable grid + optional worldX/Z)
- Airways: sparse links between owned plots only
- Plot mesh rebuild on ownership/build change only (`syncPlotOwnershipVisuals`)
- City LOD / fog already bound skyCity interactables

If empire FPS dips: cap concurrent plot ghost previews, LOD plot décor, throttle map SVG redraw.

---

## Bug-bash before merge to main

- [ ] Rent collect + predatory leave (tenant vacates, standing hit)
- [ ] Buyout neighbor pad + optional keep-tenant
- [ ] Zoning penalty on off-zone build
- [ ] Multi-layer place + climb rails + colliders
- [ ] Shape remodel colliders / footprint
- [ ] Airway link cost + visual; load without orphan airways
- [ ] Empty multi-plot land tax toast + brass drain
- [ ] Soft goals advance through neighbor → land → garden/retail → RE expression
- [ ] Old save load: padsResetV1, bridgesCleared, standing bootstrap
- [ ] Stall front interact; flower prices; jump/roof collision

---

## Freeze gate (MP Phase 0–1 prep)

Content on this branch is **feature-complete for SP empire RE**. After bug-bash:

1. No new content systems on this branch without a new epic.
2. Balance-only / bugfix only until accounts track.
3. Merge to main only when user asks (do not auto-merge).
4. Accounts / authority / MP use this freeze as the content baseline.

---

## Explicitly out of freeze (Task 15 / later)

- Branching worker programs
- Patents after invent
- Inventable power / soul grit decision
- Board race-stat parity
- Supabase auth, ledger, multiplayer presence
