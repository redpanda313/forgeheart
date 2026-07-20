# Sky City — Phase 3 SP (true play space)

**Status:** Plan + scaffold  
**Parent:** `SKY_EMPIRE_ECONOMY_DESIGN.md`  
**Prerequisite:** Market training complete (apartment deed, 1000 brass spent)

---

## 1. What already exists in the design doc

| Topic | Design doc | Live today |
|--------|------------|------------|
| Always-on mega city | §4 always-on shard, ~32 CCU later | Market hub only (training) |
| Districts / floors / RE | §8 parcels, floors, retail | Training lease bay + apartment deed |
| NPC schedules | §9 commute, stall, home | None in open city |
| NPC demand | §5 ambient economy, buy player goods | Stall customers (sim rolls) |
| Harvest / craft / hire | §6–7, Phase 0–2 | Full market training loop |
| Robot services | Repair jobs, labor | Training repair husk + workers |
| Sky lanes / board | Floating city sample + board | Market board; sample city not in play flow |
| Multiplayer | Phase 3 deferred | Not yet |

**Gap:** No true “home city” instance after the apartment deed. Market remains the training sandbox (by design).

---

## 2. Player fantasy (your brief, locked for SP)

1. Finish market tutorial → **choose** to travel to apartment.  
2. Start at **personal house** on a floating platform + walkway to **shared plaza**.  
3. Surfboard owned (from training) **or** board shop in city.  
4. City is **~20×** training-market footprint (platforms / buildings / airways).  
5. Lease **new workshop**, expand (same economy systems, grander layout).  
6. **Neighbor** gives first-time hints.  
7. **Alive:** NPCs live in homes, commute (cars/boards), work, market, buy goods (including player stock when multiplayer / stall linked).  
8. **Airways** between plazas for board travel.  
9. **Robots** help; chance of going hostile → repair for brass.  
10. Same loops as market, larger scale. Multiplayer later in **this** space.

---

## 3. Layout (SP v1 scaffold)

```
                    [Industrial workshop slips]
                              │ airways
[Residential ring] ── plaza ──┼── [Grand Market]
   player apt · neighbors     │
                              │
                    [Civic / Real Estate / Docks]
```

| District | Contents |
|----------|----------|
| **Home ring** | Player apartment platform, 4–8 neighbor homes, walkways to residential plaza |
| **Residential plaza** | Fountain, neighbor hangouts, board shop kiosk, ferry back to training market (optional) |
| **Grand Market** | Scaled market (vendors, reef access, stall opportunity, broker) |
| **Industrial** | Workshop lease pads (expandable L1–L3 like training) |
| **Sky routes** | Board airways linking plazas (reuse floatingCity sky lane pattern) |

**Scale target:** training market span ~80–100 units → city span ~400–500 units, **15–30 platforms**, multiple sky lanes. (True 20× area ≈ ~4.5× linear.)

---

## 4. Population model (SP)

### 4.1 NPC types

| Type | Role | Visual |
|------|------|--------|
| **Resident** | Home → work → market → home | Capsule + label, walks pads |
| **Flyer** | Commute on airways | Board/car mesh on sky routes |
| **Vendor** | Stationary or short stall path | Existing vendor pattern |
| **Shopper** | Visits market; chance to “buy” from player stall if present | Walks to market pad |
| **Helper robot** | Patrol / haul VFX | Robot mesh |
| **Rogue robot** | Hostile or broken → E repair for brass | Red eyes / spark |

### 4.2 Schedule (sim time, not wall clock at first)

Use a looping **city clock** `t ∈ [0,1)` day:

| Phase | t | Behavior |
|-------|---|----------|
| Commute out | 0.15–0.30 | Home → work waypoint |
| Work | 0.30–0.55 | Idle / small wander at job |
| Market / leisure | 0.55–0.75 | Work → market plaza |
| Commute home | 0.75–0.90 | Market → home |
| Night | 0.90–0.15 | At home / rare night flyers |

**Buy/sell sim (SP):** shoppers arriving at market increment soft demand (`noteMarketDemand`) and, if player has a city stall/shelf, roll purchases like training stall. No multiplayer inventory yet.

### 4.3 Pathfinding

- Walk NPCs: **nav grid** per major pad cluster (reuse `NavGrid`) or waypoint graphs between dock points.  
- Flyers: sample **sky route** polylines (no full 3D air nav v1).  
- Player board: same free-roam + airways preferential path as floating city sample.

---

## 5. Economy in the city (reuse)

- Same `InventoryState` / craft / programs / stall pricing.  
- **New workshop** lease in industrial district (separate from training bay or migrate deed — **TBD**).  
- Player stall can later bind to grand market frontage.  
- Rogue robot repairs = brass faucet + attention beat.

---

## 6. Technical slice order

1. **Scaffold world** + apartment spawn + travel from market RE.  
2. Neighbor dialogue.  
3. Ambient NPCs + flyers.  
4. City workshop lease + board shop.  
5. Grand market vendors (reuse economy).  
6. Rogue robots.  
7. City stall link + shopper purchases.  
8. Multiplayer hooks later (same levelId / shard).

---

## 7. Open questions (for you)

1. **Training market after apartment** — keep reachable (ferry) or one-way graduation?  
2. **Training bay / stall inventory** — transfer into city workshop, or fresh city lease?  
3. **Elias** — present in apartment?  
4. **Day length** — real minutes per full cycle (e.g. 8–12 min)?  
5. **Rogue robot rate** — rare spice or frequent mini-game?  
6. **Win condition in city** — none (sandbox) vs soft goals (expand workshop, reputation)?

---

## 8. Multiplayer note

This city **is** the future multiplayer map. SP systems should use the same entities (parcels, NPCs, stalls) with local sim; server later owns authority.
