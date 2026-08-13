# Online multiplayer — prove fun before Roblox

## Goal

Ship a **browser multiplayer vertical slice** that proves co-op and competitive empire loops are fun — so the full game can be rebuilt on **Roblox** with design confidence.

**North star:** Session-based sky city with up to **9 players**, residential start plaza spawn, and a **living market** that feels real in solo, co-op, *and* competitive.

**Critical design lock (this refinement):**  
**Expanded market dynamics are not competitive-only.** Customer depth, NPC livelihoods, reputation → sales, social rate limits, and richer dialogue ship as **one shared economy layer** used by:

1. **Single-player (SP)**  
2. **Cooperative multiplayer**  
3. **Competitive multiplayer**  

What differs by mode is **who owns brass/stock/property** and **who you compete with** — not whether the city has real customers and NPC rent stress.

**Not the goal yet:** Always-on 32-CCU MMO, full payment-grade anti-cheat, production hosting. Those remain longer targets in `SKY_EMPIRE_ECONOMY_DESIGN.md` / `ACCOUNTS_AND_SECURITY.md`.

---

## What exists today (baseline)

| Layer | State |
|-------|--------|
| SP empire loop | Soft goals, neighbors, plaza plots, stalls, invent, workers, labor/housing market — **on main** |
| Market sim (Layer M) | Under/over-serve, standing→sales, NPC livelihood/homeless, rate limits, sales HUD — **SP live** |
| Labor / housing | ~30 human baseline; housing beds expand hire supply; migrant tenants on rent accept |
| Client world | Three.js mega city; AOI helpers; **MP presence avatars (beta)** |
| Accounts | Home-PC username/password + 3 cloud slots; **save sync**, not full economy authority |
| Multiplayer runtime | **Presence rooms** (`tools/mp-server.mjs`) — join codes, poses; **not** shared inv yet |
| Sim extract | `src/forgeheart/sim/` mode + protocol + re-exports pure market/labor |
| Roblox | Plan only — rebuild, not port |

**Living status doc:** `docs/MP_IMPLEMENTATION_STATUS.md`

**Implication:**  
1. **Market depth** is a **SP + MP shared systems** epic (build once).  
2. **Realtime multiplayer** still needs a new room/WS layer.

---

## Architecture: three layers

```text
┌─────────────────────────────────────────────────────────────┐
│  LAYER M — Shared market dynamics (SP + Co-op + Comp)       │
│  Customers · NPC wages/rent · reputation→sales · dialogue   │
│  Social rate limits · under/overserved plazas               │
└─────────────────────────────────────────────────────────────┘
                              ▲
         used by all modes     │
┌──────────────┬───────────────┴───────────────┬──────────────┐
│  SP solo     │  Path A Co-op                 │  Path B Comp │
│  1 wallet    │  1 team wallet                │  N wallets   │
│  local sim   │  room authority + presence    │  room + PvP  │
└──────────────┴───────────────────────────────┴──────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│  LAYER N — Net foundations (Co-op + Comp only)              │
│  Rooms · WebSocket · avatars · join codes · homes spawn     │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** Never implement a customer/NPC livelihood feature “only for competitive.” If it ships for Path B, it must already run in SP and Path A (or ship in Layer M *before* competitive).

---

## Layer M — Shared market dynamics (all modes)

Build in **SP first** (or SP-parallel with early co-op netcode), then both multiplayer modes inherit automatically.

### M1 — Customer depth

Replace pure random stall ticks with a real demand pipeline:

```
Customer (or batch):
  need category (mats / frames / inventions / gifts / flowers)
  budget, quality preference
  plaza attractiveness = f(stall count, decoration, avg price, reputation, travel)
  pick plaza → pick stall (reputation + décor + price + novelty + stock match)
  buy or walk away
```

| Factor | Effect (SP / Co-op / Comp) |
|--------|----------------------------|
| **Underserved plaza** | Few stalls in category → more traffic / higher willingness to pay |
| **Overserved plaza** | Many similar stalls → split traffic, price pressure |
| **Décor / build quality** | Attract score from stall builder props |
| **Reputation** | Standing + relevant NPC affinity boost approach rate |
| **Stock match** | No matching goods → bounce |

**Mode nuance (not different systems):**

| Mode | Who benefits from a “good” stall |
|------|----------------------------------|
| SP | Solo player vs NPC vendors |
| Co-op | **Team** stalls share attract/reputation pool (team standing + team social work) |
| Comp | **Each player’s** stall competes; under/over-serve is a real competitive lever |

### M2 — NPC livelihood (real wages & rent)

- Vendor NPCs earn from stands via the **same sales pipeline** (or a close simplified sibling) as player stalls  
- On upkeep ticks: **rent due** on home/plot  
- Fail rent → drama → force-close stall → escalate to **homeless wanderer** (talkable, hireable, giftable)  
- Players/teams can rescue (hire, clear debt, gift) → affinity + standing → **sales boost** via M1  

**Mode nuance:**

| Mode | Interaction |
|------|-------------|
| SP | Living city pressure; rescue loops for soft goals |
| Co-op | Shared social work (any member talks/gifts/hires); team reputation |
| Comp | Rival can poach reputation or leave a plaza; homeless NPCs are shared social opportunities |

### M3 — Reputation → sales (legible)

- District standing + personal NPC affinity feed stall attract  
- Soft goals already track standing — wire **explicit sales multiplier** and HUD feedback (“Friendly standing · +12% residential foot traffic”)  
- Same formula everywhere; co-op uses **team standing** aggregate, comp uses **per-player**

### M4 — Social rate limits (all modes)

| Action | Rate limit (v1) |
|--------|------------------|
| Talk / Learn (affinity grant) | **~1 per NPC per 60s** (spam chat OK, no farm) |
| Gift | Existing item/brass costs; optional 1 meaningful gift / 30s / NPC |
| Hire | Bay/crew slot limited |

Applies to **neighbors, working NPCs, and homeless** wanderers.

### M5 — Talkable world NPCs

- Any NPC that wanders for work **or** is homeless without job/home is interactable  
- Unified talk UI path (extend neighbor / vendor / kit NPC interacts)  
- Homeless = high-value social targets (hire, gift, clear debt)

### M6 — Dialogue depth + rare backstory callouts

- Expand line pools by job / drama / district / housing state  
- **Rare** (5–15%) backstory hooks when player axes match NPC tags  
- Never gate critical info behind rare lines  
- SP/co-op/comp share the same dialogue tables  

### M7 — Market balance pass

- Faucets/sinks still work when customers are smarter  
- Pad ownership tick stays negligible (already tuned)  
- NPC foreclosure should be visible but not city-collapsing  
- Co-op shared wealth vs comp private wealth use **same customer math**

### M8 — Player-to-player markets (shared rules; mode adapters)

These are **first-class market verbs** for competitive multiplayer and should exist in the **same systems layer** so SP/co-op can use NPC-facing variants without a second economy.

#### M8a — Plaza property listings (player → player)

- Owner of a **player-owned plaza plot** can set a **list price** (for sale) or delist  
- Listing is public in-room (map pin / lease-office “For sale by player” list)  
- Buyer pays list price → brass transfers seller → buyer  
- **Improvements transfer with the plot:** buildings, shape, decks, local placement, rent policy/tenant (buyer may keep, redevelop, or demolish within existing plot rules)  
- Airways: v1 policy — **break links** that required dual ownership unless both ends still owned by buyer/team; document in M0  
- **SP:** same listing UX vs **NPC/city buyout** already exists; extend so player can “list” for narrative/NPC offers later if desired  
- **Co-op:** team-owned plots — any member with permission can list; sale proceeds → **team wallet**; buyer is another team only if multi-team later (v1 co-op = one team, so listing mainly for **future multi-crew** or disabled in pure co-op)  
- **Comp:** core loop — flip pads, buy improved skyline, redevelop  

#### M8b — Buy from other players’ stalls

- Player stalls accept **player shoppers** (not only NPC customers)  
- Walk up / interact → buy listed shelf goods / inventions / frames at **posted ask**  
- Brass: buyer → seller; stock decrements; same price/demand UI as NPC traffic  
- **SP:** N/A for human buyers; NPC customers already buy  
- **Co-op:** teammates may buy from team stall (optional free withdraw instead of buy — prefer **warehouse withdraw** for team stock to avoid pointless brass churn)  
- **Comp:** full P2P retail  

#### M8c — Poach employees (offer better pay)

- Target: **another player’s hired worker** (human/robot on their crew), or in SP an **NPC-employed** worker where modeled  
- Action: offer **higher wage grade / pay package** (brass signing bonus optional)  
- On accept: worker leaves old employer → joins buyer if **bay slot free**; old employer toast  
- Rate limits / cooldowns so poaching isn’t pure grief spam (e.g. 1 poach attempt per target per N minutes; standing hit if predatory)  
- **SP:** “steal” from NPC employers / rivals if job system exposes them; otherwise hire from open labor only  
- **Co-op:** **disabled within team** (shared crew); enabled only vs outside crews if multi-team  
- **Comp:** full labor war  

| Verb | SP | Co-op | Comp |
|------|----|-------|------|
| List/sell plaza plot | NPC/city-facing; prep UX | Team treasury if multi-team; else low priority | **Yes** |
| Keep/redevelop improvements on buy | Yes (already on plot buy) | Yes | **Yes** |
| Buy from player stall | NPC only | Team withdraw preferred | **Yes** |
| Poach employees | Vs NPC labor if modeled | Not vs teammates | **Yes** |

### Layer M implementation slices

| Epic | Outcome | Modes unlocked |
|------|---------|----------------|
| **M0** Spec lock | Formulas for customer pick, rent fail, rep→traffic, **P2P sale/poach rules** | Design |
| **M1** Customer sim v1 | Plaza under/over-serve + stall choice | SP first |
| **M2** NPC wages + rent fail | Close stall / homeless + wander interact | SP |
| **M3** Affinity → sales + rate limits | Talk/gift/hire matter for revenue | SP |
| **M4** Dialogue pack | Deeper lines + rare backstory | SP |
| **M5** HUD legibility | Why sales rose/fell | SP |
| **M6** Mode adapters | Team rep (co-op) / per-player rep (comp) flags | MP |
| **M8** P2P markets | Plot listings, player-stall shopping, employee poach | Comp primary; adapters for SP/co-op |

**Playtest gate (SP):** A solo player can raise sales **without** only grinding harvest — décor + social + plaza choice matter; at least one NPC economic failure is visible and interactive.

---

## Layer N — Net foundations (Co-op + Comp)

### N0 — Session host model

| Decision | Recommendation |
|----------|----------------|
| Topology | **Session rooms**, not always-on shards |
| Capacity | **2–9 players** |
| Authority | Node process (`tools/mp-server.mjs` or extended account server) — one sim per room |
| Transport | **WebSocket** presence + deltas; HTTP for login/saves |
| Identity | Account token and/or room invite codes |
| Sim scope | **Mega city empire** (sandbox loadout OK for tests) |
| Homes | Residential plaza: **1 apartment pad per joiner** (max 9) |
| Deploy | Home Mac + cloudflared (same ops story as accounts) |

```
GitHub Pages (clients)
        │  WSS / HTTPS
        ▼
Home PC  mp-server  (rooms, presence, world + market sim)
        │
   account-server (login + SP slots)  — optional for guests
```

### N1 — Presence & avatars

- Nameplates, simple meshes, interpolated pose  
- Join/leave; AOI for remote LOD  
- No voice v1  

### N2 — Room UX

- Create room / join code  
- Mode: **Cooperative** | **Competitive**  
- Lobby → city → personal home pads  

### N3 — Ops (your machine)

| You run | Notes |
|---------|--------|
| Account server | If login required |
| MP server + tunnel | Friends join via code + Pages URL |
| Keep Mac awake | Tunnel dies on sleep |
| Update tunnel URL in config when free cloudflared rotates | Same as accounts |

**Not doable with only today’s code** — needs MP server + client net. Accounts + Pages are scaffolding only.

### N4 — Roblox transfer

Document **rules** (shared market formulas, co-op shared wallet, comp private wallet) as portable.  
Throw away Node/WS/Three.js; rebuild Places + ServerScriptService later.

---

## Path A — Cooperative (easier multiplayer path)

### Fantasy

Friends as one **crew**. Shared wealth and property; labor divides. The **city market is still deep** (Layer M) — you’re cooperating *against* scarcity, NPC rent drama, and bad plaza choices, not against each other.

### Design locks

| Topic | Decision |
|-------|----------|
| Team size | **2–9** |
| Resources | **Shared brass + shared inventory** |
| Inventions | **Shared recipe book** |
| Property | **Shared** team plots/stalls |
| Harvest / craft / sell | Any member; team stock |
| Homes | **Personal** spawn/customize; **not** separate economies |
| Market dynamics | **Full Layer M** (same as SP) |
| Reputation | **Team** standing + pooled social actions |
| Soft goals | Team-level or any-member complete |
| Grief | Trusted team; optional confirm big spends later |

### Why “easier”

- **One** inventory for the room  
- Layer M already built for SP — co-op mostly **hosts it once** and broadcasts  
- Netcode proves presence + shared authority without N-way inventory conflicts  

### Path A epics (after Layer M baseline + N0–N2)

| Epic | Outcome |
|------|---------|
| **A1** Room + WS presence | 2–9 avatars |
| **A2** Team inventory authority | Server team inv + intents |
| **A3** Shared stalls/plots | Team lease/develop |
| **A4** Shared invent/craft/hire | One book, one crew |
| **A5** Personal homes | 9 pads |
| **A6** Team reputation adapter | Social actions credit team rep → M1 sales |
| **A7** Polish | Disconnect, host migrate, join codes |

**Playtest gate:** 3–4 friends, shared brass, deep customers matter, team social raises stall traffic, shared skyline; feels better than solo.

---

## Path B — Competitive (harder multiplayer path)

### Fantasy

Rivals in the **same living city**. Private wallets. Retail war using the **same** customer/NPC systems as SP/co-op — but every stall and reputation is **yours vs theirs**.

### Design locks

| Topic | Decision |
|-------|----------|
| Players | **2–9**, **private** wallets & inventories |
| Property | Private plots/stalls; contest via market only (no theft/PvP combat) |
| Homes | Personal residential pads |
| Market dynamics | **Full Layer M** (identical formulas) |
| Reputation | **Per-player** standing + affinities |
| Patents | Personal books; optional later license to rivals |
| Competition levers | Plaza under/over-serve, décor, price, social grind, NPC rescue races, **P2P plot flips, stall sales, labor poaching** |
| P2P property | List plot for brass; buyer gets improvements (M8a) |
| P2P retail | Players buy from each other’s stalls at posted asks (M8b) |
| Labor war | Offer higher pay to steal another player’s employees (M8c) |

### Why harder (even with Layer M done)

1. **N inventories** + fair mutation ordering  
2. Harvest/stock contention and first-mover on underserved plazas  
3. Balance so reputation/décor can beat pure AFK harvest  
4. Anti-grief: no theft of goods; **sales and poaching are explicit consenting market actions**  
5. **Atomic transfers** (plot sale + brass + ownership) must be room-authoritative  

### Path B epics (Layer M + Path A netcode first)

| Epic | Outcome |
|------|---------|
| **B1** Private wallets on shared room | Fork A2 → Map of invs |
| **B2** Private plots/stalls | Ownership + per-player NPC sales |
| **B3** P2P plot market | List/buy plots; improvements transfer (M8a) |
| **B4** P2P stall shopping | Players purchase from player shelves (M8b) |
| **B5** Employee poaching | Higher wage offer steals workers (M8c) |
| **B6** Competitive balance | Traffic split; soft-start; poach cooldowns |
| **B7** Optional patent license | Brass for recipe rights |
| **B8** Comp playtest | 4–9 retail + labor + real-estate war |

**Playtest gate:** Winner can be explained by stock + décor + plaza + reputation **and/or** smart plot flips / poaching — not only harvest volume; NPC failure still appears and is interactive; a player can buy another’s improved pad and keep buildings.

---

## Comparison (refined)

| | **SP** | **Path A Co-op** | **Path B Comp** |
|--|--------|------------------|-----------------|
| Layer M market | Yes | Yes | Yes |
| Wallet | Solo | Shared team | Private N |
| Invent book | Solo | Shared | Private |
| Property | Solo | Shared | Private |
| Reputation | Solo | Team pool | Per player |
| Netcode | None | Room + presence | Room + presence + N inv |
| Design load | Layer M | Low MP delta | Medium MP delta |
| Fun proof | Living city alone | Crew empire | Retail war |

---

## Recommended roadmap

```text
PHASE 0 — Shared market dynamics (SP)
  M0  Spec: customers, NPC rent, rep→sales, rate limits, dialogue rules
  M1  Customer sim (under/over-served plazas)
  M2  NPC wages + rent fail + homeless wander
  M3  Affinity → sales + talk rate limits
  M4  Dialogue depth + rare backstory callouts
  M5  HUD: why customers came / left
  PLAYTEST SP: social + décor + plaza choice beat pure harvest grind

PHASE 1 — Net foundations
  N0–N2  Rooms, WS, avatars, lobby, home pads
  N3     Home Mac runbook (accounts + mp + tunnel)

PHASE 2 — Path A Cooperative
  A1–A7  Team inv, shared property, team rep adapter, polish
  PLAYTEST: 3–4 friend co-op with full Layer M city

PHASE 3 — Path B Competitive
  B1–B2  Private wallets + plots/stalls
  B3–B5  P2P plot sales, stall shopping, employee poach
  B6–B8  Balance + playtest
  PLAYTEST: retail + RE + labor war

PHASE 4 — Roblox handoff
  Export Layer M rules + co-op vs comp ownership rules
  Rebuild; do not port browser stack
```

**Key ordering change vs prior draft:**  
Deep market is **Phase 0 in SP**, not “only after competitive design.” Co-op does **not** ship a shallow stall tick world.

---

## Technical sketch

### Shared sim core

```ts
// Pure / Node-callable where possible
MarketSim {
  tickCustomers(world, mode: 'sp' | 'coop' | 'comp')
  tickNpcLivelihoods(world)
  attractScore(stall, actor: Player | Team)
}

// Ownership adapters
resolveStallOwner(stall) → solo | team | playerId
resolveWallet(actor) → InventoryState
resolveReputation(actor) → standing + affinities
```

### Room state

```ts
Room {
  id, code, mode: 'coop' | 'comp', maxPlayers: 9
  players: { id, username, x, z, yaw, homePadId }[]
  // coop:
  teamInv: InventoryState
  // comp:
  playerInv: Map<playerId, InventoryState>
  // world (shared Layer M):
  plazaPlots, neighborLife, stalls, npcRuntime, customerSim
}
```

### Extraction risk

Economy is client-heavy today. Layer M + MP need **`src/forgeheart/sim/`** (or equivalent) pure apply/tick functions usable from browser SP **and** Node room host.

---

## What you do vs engineering

| Task | Who |
|------|-----|
| Approve: Layer M shared across SP/co-op/comp | **You** |
| Approve: Co-op first MP, then Comp | **You** (recommended) |
| Run accounts + MP server + tunnel for tests | **You** (ops) |
| Friend playtests | **You** |
| Implement Layer M in SP | **Engineering** |
| Implement net + co-op + comp adapters | **Engineering** |
| Roblox production | **Future separate project** |
| 24/7 public host | Optional later; home PC enough for prove-fun |

**Today:** SP + cloud saves only. **No multiplayer** until Layer N.  
**Market depth:** can start in SP **without** multiplayer online.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Layer M delays co-op netcode | Parallel: thin N1 presence while M1–M2 land in SP |
| Co-op feels “same as SP with friends” | Team labor UX + shared skyline moments; market depth still adds life |
| Comp balance collapses without unique systems | Same Layer M; competition is ownership + N wallets, not a second market |
| Home host sleep | Document keep-awake; later VPS |
| Tunnel URL rotates | Named tunnel or update `account-api.json` / mp config |
| Scope explosion | Freeze M0 numbers before coding; no theft/combat in MP slice |

---

## Success criteria

**Layer M (SP) done when:**  
Solo sales respond to décor, plaza supply, and social reputation; NPC stall/home failure is visible and interactive; talk affinity is rate-limited.

**Path A done when:**  
3+ humans, shared wallet/book/property, **same living market**, personal homes, “we’re a crew.”

**Path B done when:**  
Players compete with **private** wallets on that same market; plaza under/over-serve and reputation are competitive levers.

**Roblox-ready when:**  
Layer M rules + co-op/comp ownership rules are fun and written down — independent of browser stack.

---

## Open decisions (defaults)

| # | Topic | Default |
|---|--------|---------|
| 1 | Layer M before or after first avatar presence | **SP Layer M first**; optional parallel N1 |
| 2 | Co-op team save persistence | Optional host disk; not personal cloud slots |
| 3 | MP requires SP tutorial done | **No** — sandbox loadout for tests |
| 4 | Combat in this MP slice | **Off** |
| 5 | Max players | **9** both modes |

---

## First coding steps (after plan approval)

1. **M0** — Write concrete customer + rent-fail + rep→traffic numbers (short design table).  
2. **M1** — SP customer sim v1 (under/over-served plazas).  
3. **N1** (optional parallel) — WS room + 2 avatars in city.

Proves market depth and connectivity as separate pillars before combining.

---

## M0 frozen numbers (SP v1 — `src/forgeheart/marketSim.ts`)

| Factor | Rule |
|--------|------|
| Need categories | mats · parts · frames · inventions · gifts · flowers |
| Underserved (≤1 open player stall stocks need) | ×**1.28** traffic |
| Balanced (2) | ×**1.0** |
| Busy (3) | ×**0.88** |
| Overserved (4+) | ×**0.72** |
| Empire standing 0–100 | up to **+22%** sale chance |
| District standing −20–100 | up to **+12%** / down to **−8%** |
| Known-neighbor affinity avg | up to **+10%** goodwill |
| Décor / layout (placement mul) | half of `(placementMul − 1)` |
| Talk / Learn affinity grant | **1 / 60s / NPC** (chat always OK) |
| Meaningful gift affinity | **1 / 30s / NPC** (goods or brass ≥50) |
| NPC livelihood fail | **12%** per landlord-rent tick if stressed |
| Homeless | **2** fails **or** debt ≥ **1.5×** start debt |
| Backstory hook on chat | **~10%** rare; never gates critical info |

**P2P sale / poach (M8 rules sketch — MP later):** plot list transfers improvements; airways break unless buyer owns both ends; stall shop = posted ask; poach = higher wage + bay slot + cooldown; SP uses NPC-facing variants only.
