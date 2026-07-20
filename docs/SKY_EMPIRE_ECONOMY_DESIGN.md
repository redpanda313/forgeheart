# Sky Empire — City Economy, Robots & Massive Multiplayer Design

**Status:** Vision / foundation planning — **player decisions locked v0.2** (see §0)  
**Parent product:** ForgeHeart (steampunk floating city, Three.js vertical slice)  
**Working title (economy layer):** *Sky Empire* / *Brass Markets* (rename TBD)  
**Core fantasy:** Pro-capitalist steampunk MMO — invent, manufacture, trade, buy real estate, hire labor (robot + human), and win retail wars in a living sky city.

---

## 0. Decisions locked (from design interview)

| # | Topic | Decision |
|---|--------|----------|
| 1 | Capitalism tone | **Sincere invisible backdrop** — pro-market systems exist; never lectured or lampshaded as satire |
| 2 | Player origin / Elias-class lore | **Procedural engineer backstory** — ~6 axes × ~6 values each; every competing inventor has a unique “lost someone / why they build” story like Elias |
| 3 | Combat | **Minimum** — optional service jobs: **police** and **robot repair** (fun loops, not war sim) |
| 4 | World model | **Always-on mega city** |
| 5 | v1 concurrency | **~32 concurrent** per city layer / shard target |
| 6 | Persistence | **Permanent economy for now**; **design hooks for seasonal wipes later** |
| 7 | Premium currency | **Aether** — convenience alternate to common brass |
| 8 | Theft / hard grief | **Off for now** |
| 9 | Player banks / scrip | **Not in v1** |
| 10 | Invention scripting | **Minor visual scripting** (constrained nodes) |
| 11 | IP / patents | **C Hybrid locked** — personal recipe book + optional tradeable patent licenses |
| 12 | Harvest | **PvE for now** (instanced / guided reefs) |
| 13 | Manual forever > automation | **No** — automation may eventually dominate if invested; manual remains on-ramp + niche |
| 14 | Land supply | **Soft-infinite** sky platforms (cost / bureaucracy scales up) |
| 15 | Vertical RE | **Yes** — floor-by-floor ownership in design from v1 |
| 16 | NPC depth / romance | **Deep RPG lives**; **all PCs are boys**; can **date girl NPCs** |
| 17 | NPC death | **If killed, quickly replaced by similar NPC** (stability) |
| 18 | Client | **Browser-first**; plan **mobile browser touch** later |
| 19 | Monetization | **Convenience** (not raw power packs / ore printers) |
| 20 | Next three systems | **Market + Harvest mini-game + Parcel lease** |

### 0.1 IP model — Hybrid (C) locked

- **Personal recipe book:** you can always craft what you discovered.  
- **Optional patent:** sell/license craft rights to others for a period.  
- Inventor never loses the ability to produce their own invention.

### 0.2 Romance / marriage (locked)

- Gifts raise relationship.  
- **Marriage** unlocks a **home addition on the workshop / personal bay** with wife NPC.  
- Later: ceremony + dating milestone story events.

### 0.3 Soul grit — explanation (for your decision later)

**Soul grit** is the narrative resource from ForgeHeart: the idea that **personhood can cling to metal** (Elias’s talisman / frame).

In economy terms it could mean:

| Approach | Gameplay | Tone |
|----------|----------|------|
| **A. Pure story** | Never a craft mat; only backstory/dialogue | Safest morally; less systems |
| **B. Regulated rare mat** | Needed for top-tier “true” robots; heavily taxed / licensed | High drama; ethical capitalism tension (still unmentioned, systemic) |
| **C. Optional premium path** | Normal robots use brass/alloys; soul grit unlocks companion-tier bots with better loyalty | Dual product lines |

**Not locked yet** — Phase 0 does not need soul grit. Decide before robot factory goes live.

### 0.4 Character create & multiplayer social

- **Personalized unique backstory tutorial** before entering the shared world (generator).  
- **Full build** on owned floors (Game Maker-class freedom in parcels).  
- Play **solo** or **teams of friends** (shared corp / parcel access later).

### 0.5 Phase 0–1 implementation note

Racetrack + floating-city sample cleared from play flow.

- **Phase 0 (done):** market vendors, cloud reef harvest mini-game, starter parcel lease.
- **Phase 1 SP (done):** bay workbench recipes, Frame Broker, hire, field repair.
- **Phase 2 SP Workshop Scale (advanced):** expandable bay; A\* nav; programs; bay Game Maker; board; invent; stall pricing/demand; **market training goal: earn 1000 brass → buy sky apartment at Real Estate (east path)**. Workshop remains story tutorial before market.

---

## 1. Elevator pitch

You are an engineer-capitalist in a floating metropolis. You harvest ore and scrap from cloud reefs, research alloys in labs, build robots with **player-invented** abilities, lease storefronts, undercut rivals, and automate supply chains. The city never sleeps: NPC shopkeepers open at dawn, robots work the night shift, and player markets set the price of brass.

Capitalism is the **air you breathe**, not a speech — systems reward trade, brand, and reinvestment without moralizing.

**Win conditions are economic and social, not combat scores:** market share, brand reputation, district control, patents, and vertical integration. Combat-adjacent jobs (police, repair) exist as **services**.

**North star:** *A living always-on city that is fun at 32 concurrent and designed to grow.*

---

## 2. Pillars (design contracts)

| Pillar | Promise |
|--------|---------|
| **Capitalism as gameplay** | Prices, scarcity, leases, wages, branding, risk, monopoly pressure — **sincere, unmentioned** |
| **Invention as power** | New materials / processes / robot skills are first-class products (minor visual scripting) |
| **Origin as identity** | Procedural “why I build” backstories (Elias-class variance) |
| **City as character** | Districts, deep NPC lives, romance, boom/bust cycles |
| **Automation ladder** | Fun manual loops → hire → robotize → empire dashboard (automation can win long-term) |
| **Presence at every scale** | Alive at low pop; channel/LOD ready for growth |
| **Fair multiplayer** | Premium = **convenience**, not pay-to-skip invention |

---

## 3. Systems inventory (what must exist)

### 3.1 Core loops

```
HARVEST → PROCESS → RESEARCH → MANUFACTURE → DISTRIBUTE → SELL → REINVEST
     ↑________________ automation / hire / logistics __________________|
```

Secondary loops:
- **Real estate:** bid → renovate → zone → lease / operate retail
- **Labor:** hire NPC / robot / player → contracts → reputation
- **IP:** file patent → license → sue / steal / reverse-engineer (with risk)
- **Politics:** district boards, tariffs, zoning votes (soft PvP)

### 3.2 System map (modules)

| Module | Responsibility | Depends on |
|--------|----------------|------------|
| **Identity & account** | Characters, corps, friends, reputation | Auth |
| **World services** | Instances, shards, streaming, presence | Identity |
| **Inventory & items** | Stacks, quality, provenance, patents | DB |
| **Resources & nodes** | Harvestables, respawn, ownership | World |
| **Crafting / assembly** | Recipes, quality, batch production | Inventory, Research |
| **Research / invention** | Labs, tech trees, player-authored recipes | Crafting |
| **Robot factory** | Chassis, modules, firmware, QA | Crafting, Research |
| **Robot runtime** | Jobs, pathing, combat, AI roles | World, Robots |
| **Market** | Orders, stalls, auctions, contracts | Inventory, Currency |
| **Currency & banking** | Brass (liquid), equity, debt, taxes | Market |
| **Real estate** | Parcels, leases, renovation, zoning | World, Currency |
| **Retail** | Shop space, stock, NPCs as customers | Market, RE |
| **Labor market** | Jobs board, wages, player gigs | Robots, Identity |
| **NPC life** | Schedules, needs, dialogue, hiring | World |
| **Logistics** | Routes, sky lanes, storage, theft risk | World, Robots |
| **Progression** | Soft caps, prestige brands, empire tiers | All |
| **Social** | Chat, corps, alliances, mail | Identity |
| **Anti-cheat / economy health** | Dupes, inflation, bot farms | All |

### 3.3 Player-facing “careers” (not classes — roles you *buy into*)

- **Prospector** — harvest cloud reefs, claim nodes, sell raw goods  
- **Metallurgist** — smelt, alloy, invent materials  
- **Roboticist** — chassis + ability firmware  
- **Merchant** — retail, arbitrage, brand  
- **Landlord / developer** — parcels, malls, industrial parks  
- **Logistician** — sky routes, warehouses, courier fleets  
- **Labor broker** — hire NPC/robots/players, staff factories  
- **Financier** — loans, equity stakes, insurance (late game)

Most players hybridize; the systems must reward **vertical integration** without forcing it.

---

## 4. Online architecture

### 4.1 Locked direction

- **Always-on mega city** (not session-only lobby hopping as the core).  
- **v1 target: ~32 concurrent** players per city shard — design systems so 32 feels full (NPC density + channel merge later).  
- **Permanent world for now**; code economy with **season tags** so wipes can exist later without rewrite.  
- **Browser-first**; input abstraction ready for **mobile touch** later.  
- **Theft/grief off** in v1 — no player looting or parcel raiding.  
- **Player banks not in v1** — city mint + personal wallets only.

### 4.2 High-level model

```
Global meta (accounts, corps, patents, leaderboards, auction house)
        │
        ▼
Regional mega-city shard(s)  ← v1: one shard is fine if ≤32 CCU
        │
        ├── Always-on public city (markets, docks, streets)
        ├── Private parcel / floor instances (visit rules)
        ├── PvE harvest reef instances
        └── (Future) Channels when CCU grows past comfort
```

### 4.3 Realms, regions, lobbies

| Concept | Purpose |
|---------|---------|
| **Region** | Latency (add when multi-region needed) |
| **City shard** | Always-on economy + presence |
| **Channel** | Future overflow for plazas; shared auction |
| **Private instance** | Lab, factory floor, apartment, shop interior |
| **PvE reef instance** | Harvest runs (matchmade or solo) |

**v1 simplicity:** one always-on city + private interiors + PvE reefs. Scale channels when CCU > ~32–64.

### 4.3 What runs where (tech sketch)

| Concern | Approach |
|---------|----------|
| **Authoritative simulation** | Server-authoritative for inventory, combat, harvest, sales |
| **Client** | Three.js presentation + prediction (as current slice) |
| **Interest management** | Stream only nearby platforms / actors; AOI grids in 3D |
| **Persistence** | Parcel state, inventories, market orders, NPC schedules |
| **Realtime** | WebSockets / WebRTC data; voice optional later |
| **Matchmaking** | Reefs, co-op factory jobs, trade fair events |
| **Moderation** | Chat filters, report, name plates, trade scams |

### 4.4 Session types

1. **Open world roam** — docks, markets, streets, public parcels  
2. **Work instance** — lab / factory with capacity limits  
3. **Harvest expedition** — instanced reef with difficulty tiers  
4. **Retail floor** — shop simulation (player as clerk or automation)  
5. **Empire dashboard** — offline-progress lite while away (bounded, not free money)

---

## 5. Vibrancy at low population AND high population

### 5.1 “Alive with few players” (bootstrapping)

**Never rely on player count for life.** Seed the city with systems that move without humans:

| System | Low-pop behavior |
|--------|------------------|
| **NPC schedules** | Shop open/close, commute, lunch, nightlife per district |
| **Ambient economy** | NPC buy/sell orders against a soft “reserve bank” so stalls aren’t empty |
| **Events** | Hourly sky train, market bell, factory whistle, weather of brass fog |
| **Robot traffic** | Delivery drones on sky lanes (cheap AI, high visual density) |
| **Dynamic signage** | Prices tick, “HELP WANTED”, “FORECLOSURE” |
| **Rumors** | Gossip board updates from economy sim even if no PCs present |
| **Guest workers** | Temporary NPC caravans that need goods (quests that pay) |

**Density illusion:**  
- Many **non-interactive** silhouettes on distant platforms  
- **Channel merge:** if online < threshold, collapse channels so the one market feels full  
- **Echo actors:** optional “ghost shoppers” that are pure VFX + soft AI (cannot be scammed into free money)

### 5.2 “Stable with many players” (anti-crowd)

| Technique | Effect |
|-----------|--------|
| **Soft channel split** | Auto-open Channel 2 when plaza density exceeds N; keep shared auction |
| **District soft caps** | Industrial vs retail caps encourage spreading empires |
| **Interest culling** | You see full detail only nearby; distant players are LODs |
| **Queue for premium floors** | Luxury malls may wait-list visits; rooftop public always open |
| **Time-sliced events** | Not everyone forced into same 8pm raid |
| **Async trade** | Auction house + contracts reduce “everyone stacks on one stall” |
| **Parcel privacy** | Factories don’t need 200 visitors to function |

### 5.3 Economic population scaling

- **NPC demand scales** with active online + a floor (city never dies).  
- **Resource respawn** scales with harvesters present in instance, not global online (prevents desertion or overfarm).  
- **Land supply** expands via **new platforms** (sky zoning) when prices stay high for weeks — controlled inflation of space, not infinite free land.

---

## 6. Materials & harvesting (fun first, automatable later)

### 6.1 Design goals

1. **Manual harvest feels like a mini-game**, not a click timer forever.  
2. **Automation is a product** players build/sell (robots, drones, claims).  
3. **Scarcity is spatial and temporal**, not only RNG gates.  
4. **PvE for now** — no harvest PvP / node stealing from players.  
5. **Automation may eventually beat pure manual** at scale if invested (no permanent “manual forever king”).

### 6.2 Resource fantasy (steampunk)

| Tier | Examples | Where |
|------|----------|--------|
| **Raw** | Cloud iron, spore silk, sky salt, scrap brass, soul grit (rare/regulated) | Reefs, wrecks, undercity |
| **Processed** | Ingots, wire, glass, ceramics, fuel cells | Smelters, mills |
| **Advanced** | Memory brass, photonic alloy, living circuit | Labs + patents |
| **Abstract** | Labor-hours, brand tokens, patent licenses | Markets |

### 6.3 Harvest gameplay loop (manual)

**Cloud reef expeditions** (**PvE instances** first):

1. **Survey** — short glider / board recon; mark veins (skill expression)  
2. **Extract** — mini-games by node type:  
   - *Drill* — timing stability (resonance matching)  
   - *Net* — airborne scoop of spore clouds  
   - *Magnet* — pull scrap while dodging storms  
   - *Salvage* — puzzle disconnect of wreck modules  
3. **Haul** — mass/volume limits; risk of storm loss  
4. **Claim** — temporary stake (paid upkeep) vs free-for-all public nodes  

**Fun levers:** risk zones, day/night yields, rare “comet showers,” competitive claims, co-op multi-node extraction.

### 6.4 Automation ladder

| Stage | How | Cap |
|-------|-----|-----|
| **Hand tools** | Full mini-game | — |
| **Assisted tools** | Mini-game easier / faster | Power / durability |
| **Robot crew** | Assign routes + schedules | Robot skill + power budget |
| **Claimed facility** | Auto-extract on owned reef parcel | Upkeep + raids / taxes |
| **Corp logistics** | Full pipeline dashboard | Bureaucracy / strike risk |

Automation should **not skip all skill**: robots can fail storms, need firmware, generate defective batches, or be poached.

### 6.5 Anti-bot / anti-chore

- Vary node layouts per instance seed  
- Occasional **attention events** (storm course-correct) even for automation  
- **Diminishing returns** on pure AFK with no investment  
- Real money purchase: cosmetics / convenience, not raw ore printers

---

## 7. Invention: materials, robot abilities, player services

### 7.1 The hard problem

If “anything goes,” the economy breaks. If “only fixed trees,” invention is fake.

**Solution: constrained invention** — players author within **validated schemas**, not freeform code on day one.

### 7.2 Research facilities

| Lab type | Output |
|----------|--------|
| **Materials lab** | Alloys, coatings, catalysts |
| **Process lab** | Smelt times, yields, purity, waste |
| **Robotics lab** | Modules, firmware abilities |
| **Services studio** | Shop buffs, logistics packages, insurance products |

Research consumes: time, reagents, power, and **failure risk** (exploded batch = drama + scrap).

### 7.3 Materials invention (player-authored)

**Schema example:**

```text
Material {
  base_components: weighted list from known materials
  process: [smelt | alloy | weave | etch | temper]
  parameters: temperature, pressure, duration, catalyst
  outcomes: purity curve, traits[], defects[]
}
```

**Traits** (closed set, combinable): conductive, magnetic, light, soul-permeable, heatproof, beautiful, fragile, radioactive (regulated)…

**Discovery:** running experiments reveals traits via tests (conductometer, drop tower, soul lamp). Publishing a **named material** costs a patent fee.

### 7.4 Robot abilities (player-authored firmware)

**Launch: minor visual scripting** — a small node graph, not free code.

```text
Ability = Trigger + Action + Constraints + Cost
Trigger: on_command | on_schedule | on_threat | on_cargo_full | on_shop_empty
Action: harvest | haul | guard | craft_assist | sales_clerk | repair | explore_mark | patrol | tow
Constraints: zone, load, friend/foe rules
Cost: plasma/power, wear, legal risk
Gas limit: max nodes / max ops per tick (anti-lag / anti-exploit)
```

Players invent **named firmware** (“Night Courier v3”, “Showroom Greeter”) and sell licenses (see hybrid IP).

### 7.5 Unique services (genuinely useful)

Services must plug into **real sinks/sources**:

| Service | Why useful |
|---------|------------|
| **Courier contract** | Moves goods across districts faster than self-haul |
| **QA certification** | Raises robot resale price / retail trust |
| **Insurance** | Covers storm loss / theft (payouts from provider reserves) |
| **Retail staffing** | NPC demand conversion rate up while staffed |
| **Research contract** | Labs for hire if you lack space |
| **Brand consultancy** | Temporary demand shift for a product line |
| **Security** | Reduces theft on parcels |

Player services register as **offers** on a public board with SLAs (time, price, bond).

### 7.6 IP & patents (hybrid model — pending confirm)

**Personal recipe book (always yours)**  
- Completing research unlocks craft rights on **your account** forever (or until wipe era).  
- You can always manufacture what you discovered.

**Optional patent filing**  
- Pay fee + disclose schema → get a **Patent Deed**.  
- Deed lets you sell **time-limited licenses** to others (they gain craft rights while licensed).  
- Exclusive sale of deed transfers licensing rights (you keep personal craft).  
- Patents expire after N seasons / real months → knowledge becomes common or remains craftable by discoverers only (TBD).

This is the **hybrid** answer to question 11 — invention is personal *and* a market product.

---

## 7A. Engineer origin generator (Elias-class backstories)

Every player engineer gets a **generated personal myth** — same emotional weight as “lost brother Elias,” different details. Not a tutorial lock; flavor + soft quest hooks + dialogue.

### Axes (6) × values (6 each) ≈ 46,656 combinations

| Axis | Example values (6) |
|------|---------------------|
| **1. Who was lost** | Brother · Sister · Mentor · Partner · Child · Entire crew |
| **2. How they were lost** | Demon-ridden frame · Sky storm wreck · Lab explosion · Debt war · Vanished on reef · Turned into a husk willingly |
| **3. What remains** | Talisman · Incomplete chassis · Letter · Voice cylinder · Lock of brass hair · Blank patent |
| **4. Why you build** | Bring them back · Prove the lab wrong · Buy safety · Outdo a rival house · Free all souls in metal · Get rich enough to never lose again |
| **5. Moral lean** | Gentle reprogrammer · Ruthless scrapper · Strict patent idealist · Black-market salvager · City loyalist · Free-market purist |
| **6. Starting scar / perk** | Debt · Famous name · Hidden recipe · Enemy house · Ally NPC · Soft-locked district access |

**Presentation:** short generated prologue (3–5 lines) + optional “memory” interactables in personal bay.  
**Multiplayer:** other players can learn fragments via gossip / dating / hiring — never full dump on nameplate.

Competing inventors (NPC rivals) use the **same generator** so the city feels full of parallel griefs and ambitions.

---

## 7B. Low-combat service jobs

Combat is **not** the main loop. Two player-facing service careers:

### Police (sky marshal / district patrol)
- Soft enforcement: break up market scams (flag UI), escort high-value hauls, clear **scripted** reef pests (light combat)  
- Reputation with city → better dock rates, tips  
- No open PvP; “arrest” is interaction + cooldown, not gank  

### Robot repair man
- Field calls: overheating bots, bricked firmware, parade malfunctions  
- Mini-game: diagnose → replace module → bill client  
- Natural sink for spare parts; teaches robot anatomy to new players  

Both jobs are **hireable by other players** (call a repair contract) and by NPCs.

---

## 8. Real estate

### 8.1 What is owned?

| Asset | Notes |
|-------|-------|
| **Sky parcel** | Platform footprint + air rights (build height band) |
| **Floor units** | **v1:** buy/sell/lease **individual floors** inside towers |
| **Retail bay** | Storefront in a mall / street |
| **Industrial slip** | Factory / lab zoning only |
| **Reef claim** | Temporary extractive rights (PvE instances) |
| **Dock lease** | Logistics premium access |

**Land supply:** soft-infinite — new platforms mint when demand/price stay high; cost and bureaucracy rise so space never feels free spam.

### 8.2 Acquisition

1. **Auction** — city releases new platforms  
2. **Market sale** — player-to-player deed transfer  
3. **Lease** — rent from city or landlord (easier entry)  
4. **Foreclosure** — unpaid tax/upkeep → auction  
5. **Homestead** — small starter bay free / cheap with limits  

### 8.3 Development

- **Zoning:** retail / industrial / residential / mixed (city can rezone with politics)  
- **Build:** place modules (from catalog + invented parts) within footprint rules  
- **Renovate:** quality rating affects NPC foot traffic  
- **Utilities:** power, plasma grid, waste — monthly costs  

### 8.4 Retail wars

- **Foot traffic** is a resource (NPC paths + player paths)  
- **Window quality, prices, ads, staff** convert traffic to sales  
- **Location premiums** near docks / plazas  
- **Win retail space:** outbid lease, buy mall shares, or build a better destination that steals traffic (sim + marketing)

### 8.4.1 Player stall pricing (SP v1 → expand later)

**Fantasy:** set your ask, watch demand, balance margin vs throughput; better goods support higher prices.

| Layer | SP v1 (implemented / in progress) | Later |
|--------|-----------------------------------|--------|
| **Posted ask** | Per-SKU ask price on stall shelf (50–200% of fair) | Bulk presets, clerk program nodes |
| **Fair price** | City street price ≈ NPC buy band × **soft market pressure** (glut/scarce) | Festivals, district shocks |
| **Demand** | Sale chance scales with ask/fair adjusted by quality | District traffic, ads, staff |
| **Quality** | Product-line tier 0–2; **fine crafts** (polished wire, masterwork frame) | Invent certification, QA |
| **Barter** | **Haggle offers** (~18% of stall approaches) accept/refuse | P2P haggle / contracts in multiplayer |
| **Price policy** | Program nodes: shelf deals / fair / premium | Clerk automation, ads |

**Demand labels (UI):** Hot · Steady · Cool · Slow · Dead  
**Loop:** undercut fair → more sales, less margin; premium works only if quality justifies it.  
**Broker / NPC dump-sell** stay instant bulk tools; stall is brand + margin.

### 8.5 Real-estate sim health

- Soft caps on pure land speculation (vacancy taxes)  
- Improvements should beat empty holds long-term  
- Public housing / starter zones always exist so new players aren’t locked out

---

## 9. NPC lives (routines you can observe and hire)

### 9.1 NPC model

Each significant NPC has:

```text
Identity, home district, job, schedule, needs, skills, wage expectation, loyalty, secrets
```

### 9.2 Daily routine (example: market vendor)

| Time | Activity | Where |
|------|----------|-------|
| 06:00 | Wake, breakfast | Tenement platform |
| 07:00 | Commute (sky ferry) | Lanes / docks |
| 08:00–12:00 | Open stall | Market |
| 12:00 | Lunch / gossip | Café |
| 13:00–17:00 | Stall / restock | Market / warehouse |
| 18:00 | After-work drink | Pub |
| 20:00 | Home / family | Tenement |
| Night | Sleep; rare night market events | — |

Players can **find** them by knowing routines — not just quest markers.

### 9.3 Hiring NPCs

| Role | Use |
|------|-----|
| Clerk | Retail conversion |
| Smith | Craft speed / quality |
| Researcher | Lab throughput |
| Guard | Theft reduction |
| Courier | Logistics |
| Foreman | Robot crew efficiency |

**Contracts:** hourly / daily / share of profits / equity (rare).  
**Loyalty:** pay, housing quality, brand prestige, events (rescues).  
**Poaching:** rivals can offer higher wages.

### 9.4 NPC economy participation

NPCs buy player goods with simulated income, create demand shocks (festivals), and can become **named talent** (star engineer) worth competing over.

### 9.5 Deep RPG lives & romance (locked)

- **All player characters are boys** (presentation / casting rule for v1).  
- **Girl NPCs** have full schedules, homes, jobs, likes/dislikes, relationship stages.  
- **Dating:** gift, invite, date activities (café, sky walk, market night), trust meters, exclusive vs open dating rules TBD.  
- Romance can unlock: housing roommate bonuses, shop staff loyalty, story beats, introductions to other NPCs.  
- Keep it tasteful and systemic — not a separate dating sim that ignores the economy.

### 9.6 NPC death & replacement (locked)

- If an NPC is removed (rare event, accident, story) → **quick replacement** with same role + similar schedule/stats, new name/face.  
- City services never permanently brick because “the only clerk died.”  
- Optional: memorial plaque / rumor for named NPCs players cared about.

### 9.7 Making them feel alive cheaply

- Shared animation sets + schedule AI  
- Dialogue from templates + economy facts (“Brass is up 12%”)  
- Relationships graph (who knows whom)  
- Memory of player actions (“You undercut my cousin”)

---

## 10. Robots as products, workers, and status

### 10.1 Robot layers

1. **Chassis** — size, slots, durability  
2. **Power plant** — plasma budget (ties to ForgeHeart plasma fantasy)  
3. **Tools** — arms, sensors  
4. **Firmware** — abilities (inventable)  
5. **Finish / brand** — cosmetics, resale  

### 10.2 Robot markets

- **Retail bots** for NPC consumers (appliances, companions, guards)  
- **Industrial bots** for player factories  
- **Showpiece bots** for prestige  

### 10.3 Hiring robots vs people

| | Robot | NPC | Player |
|--|-------|-----|--------|
| Cost | Build + power | Wage | Wage / split |
| Reliability | Wear / bugs | Loyalty | Schedule |
| Scalability | High | Medium | Social |
| Flavor | Automation fantasy | City life | Multiplayer drama |

---

## 11. Economy health (capitalist, not broken)

### 11.1 Currencies (locked direction)

| Currency | Role |
|----------|------|
| **Brass** (common) | Wages, goods, leases, most sinks |
| **Premium** (name TBD: e.g. *Gild*) | **Convenience** — cosmetics speed, queue skip, expand inventory, rename corp, boosts that don’t print rare ore |

Premium must never mint endgame materials or exclusive patents.

### 11.2 Faucets & sinks

**Faucets:** harvest, NPC purchases, quests, events  
**Sinks:** upkeep, taxes, patents, auctions, repairs, marketing, failed research, storms, romance gifts, renovations  

### 11.3 Soft controls

- City reserve bank buys/sells commodity bands  
- Luxury sinks (tower cosmetics, parade sponsorships)  
- **Permanent world now**; season tags on items for optional future wipes  

### 11.4 PvP economy

**v1:** soft competition only — undercutting, poaching staff, ads, better locations.  
**No theft / grief.** Hard conflict deferred.

---

## 12. Content cadence & “empire” feel

### 12.1 Onboarding (first hours)

1. Tutorial (existing ForgeHeart story) → arrive in city broke but skilled  
2. Starter lease bay + basic tools  
3. First harvest run → first sale → first robot frame  
4. First hire (NPC day laborer)  
5. First patent attempt or franchise choice  

### 12.2 Mid game

- Multi-parcel logistics  
- Brand identity  
- Retail expansion wars  
- Firmware marketplace  

### 12.3 Late game

- District politics  
- Cross-channel mall ownership  
- Public infrastructure sponsorship  
- Legacy brands that outlive a character (corp persistence)

---

## 13. Technical roadmap (phased)

### Phase 0 — Single-player market sandbox (done)
1. **Market** — buy/sell commodities with NPC vendors  
2. **Harvest mini-game** — PvE reef extraction  
3. **Parcel lease** — starter bay  
4. Procedural engineer backstory on character create  

### Phase 1 — SP craft / labor / repair loop (done)
1. Bay workbench recipes → wire, gear blank, repair kit, basic robot frame  
2. Frame Broker · Hire Board · Repair job  

### Phase 2 — Workshop Scale (SP, largely done)
1. Expandable bay L1–L3 + max workers 1/2/3  
2. Visible workers + **A\* around solids** (rebuilds when bay expands / maker places)  
3. Job assignment + equip board/spanner/pack  
4. Player board shop + **rideable market board**  
5. Bay office UI (I) + invent desk L3  
6. **Visual programs** (linear node graph, assign worker)  
7. **Game Maker bay-only** bounds  
8. Upkeep/wages sink  

**Still next pass:** invent→ingredient crafts, branch programs, board race-stat parity.

### Phase 3 — Sky City SP (true play space — scaffold live)
See **`docs/SKY_CITY_SP_PLAN.md`**.
1. Travel from market training after apartment deed → spawn at home  
2. Residential plaza + neighbors + ferry back  
3. Grand Market + industrial workshop lease  
4. Ambient NPCs / flyers + sky airways  
5. Rogue robot repair jobs  
6. Multiplayer later on **this** map (~32 CCU deferred)

### Phase 4 — Automation & patents / scale
- Robot workers, patents marketplace, channels, seasons  

**Reuse from current slice:** floating platforms, sky lanes, board-as-inventory, Game Maker city building, robot ally/power fantasy (re-skinned as workforce).

---

## 14. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Empty world at launch | Heavy NPC life + channel merge |
| Inflation | Strong sinks + city bank bands |
| Pay-to-win outrage | Cosmetics / convenience only |
| Invention exploits | Schema validation + gas limits |
| Land monopoly | Vacancy tax + starter zones + land expansion |
| Crowding | Channels + LOD + async trade |
| Automation deletes fun | Keep attention events + premium manual content |
| Scams | Trade escrow, contract bonds, reputation |

---

## 15. Success metrics

- **D1/D7 retention** and return for market events  
- **% players** who complete first sale / first hire / first lease  
- **Trade volume** health (not just gold inflation)  
- **District diversity** (not 90% AFK in one plaza)  
- **UGC invention adoption** (% of sales using player patents)  
- **Subjective vibrancy** (survey + session length in social hubs)

---

## 16. Remaining questions (short list)

1. **IP model:** confirm **Hybrid (C)** — personal recipe book + optional tradeable patent licenses?  
2. **Premium currency name** (Gild / Cloudmarks / Crown Brass)?  
3. **Dating content rating** — fade-to-black romance only, or more explicit later?  
4. **Soul grit** — still a resource for top robots, or purely narrative (backstory only)?  
5. **Elias tutorial** — always the player’s generated origin, or fixed prologue then free backstory on city arrival?  
6. **Game Maker in live MMO** — full builder in owned floors only, or restricted furniture kit?  
7. **Team assumption** — solo-paced roadmap vs small team (affects Phase 1 date realism)?

---

## 17. Next design spike (approved trio)

1. **Market District (local):** plaza, NPC vendors with schedules, 8 commodities, buy/sell UI.  
2. **Harvest reef (PvE instance):** one extraction mini-game + haul weight.  
3. **Parcel lease:** starter bay + **floor unit** stub; place bench/chest/sign; soft NPC foot traffic.  

Then: spreadsheet sim of faucets/sinks; character-create **backstory generator** prototype (6×6 tables).

---

## 18. Naming & brand notes

Working names for the economy layer: *Sky Empire*, *Brass Bazaar*, *Cloud Capital*, *The Floating Exchange*.  
Keep **ForgeHeart** as story/world; economy systems can be a mode or sequel skin.

---

*Document version: 0.2 — decisions locked from design interview; IP hybrid recommended.*
