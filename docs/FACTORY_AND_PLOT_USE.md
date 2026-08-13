# Factories, workshops & plot fill

## What you can build today (player systems)

| System | Where | What it does |
|--------|--------|----------------|
| **Bay expand** | Workshop / hire board | More crew slots, invent at L3+ |
| **City workshop lease** | Industrial | Empire craft HQ + invent path |
| **Bay-wing factories** | Sky Foundry (site builder) | Visual wings per bay expand |
| **Bonded storage factories** | N Observatory / Clocktower / Aether Spire | Stack caps: resources · crafted · inventions |
| **Plaza plot: Factory** | Lease office · Develop | Industrial pad — **operator fill + foundry unlock** |
| **Plaza plot: Retail** | Lease office · Develop | Shop shell — **shopkeeper fill, player can buy** |
| **Plaza plot: Home / Apartment** | Develop | Housing — **tenant rent + named home** |
| **Plaza plot: Garden** | Develop | 5 plant beds |
| **Plaza plot: Décor** | Develop | Standing / traffic soft boost |
| **District stall lease** | Plaza stall interact | Network retail (demand sim) |
| **Surfboard shop** | Board shop | Chassis · thruster · rails · deck |
| **Foundry line** | Board shop (needs factory pad) | Gyro · aether drive · harvest gear |

## Plot fill (NPC / crew use)

On rent ticks, vacant **player** builds get **fill offers** (lease office):

1. **Housing** — NPC offers rent tier; accept → tenant + sign **"{Name}'s home"**
2. **Retail** — NPC shopkeeper; accept → stocked shop, **E to buy**, sign **"{Name}'s shop"**
3. **Factory** — idle crew or NPC; accept → **works brass** each rent tick, sign **"{Name}'s works"** / "Crew works"

Neighbor-pad return offers (earlier Layer M) still appear for vacated ring/plaza homes you own.

## Labor market & housing (v1)

| Concept | Rule |
|---------|------|
| **One home per NPC** | Residents do not double-up; new tenants are **spawned migrants** on accept |
| **Baseline labor** | ~**30** humans hireable before housing matters |
| **Soft start** | Around **25–30** crew, build apartments or wages rise |
| **Labor supply** | `30 + housing beds + 0.35× settled tenants` |
| **Tight market** | Hire cost & human wages scale up to ~×2.4; at cap **cannot hire humans** |
| **Robots** | Still hire from frames if bay has slots (less housing-bound) |
| **Accept rent** | Spawns a new named migrant into that home only |

Bay Workers tab shows live labor line. Soft goal: **House the labor market**.

## Foundry line (factory unlock)

Own any **Factory** plot → craft at board shop:

| Part | Effect |
|------|--------|
| **Gyro gimbal** | Board turn / powerslide control |
| **Aether drive coil** | Board top speed + accel |
| **Reef chronometer** | Wider harvest window, slower needle |
| **Multi-haul arm** | +yield per haul |
| **Dual-mat scanner** | Second mat type on success |

## Suggested future factory chain (not all shipped)

- Smelter → alloy billets  
- Wire mill / glass kiln (batch craft)  
- Robot chassis line  
- Patent / invent lab annex  
- Logistics dock (skyway freight)  
- Brand showroom (standing × sales)  
