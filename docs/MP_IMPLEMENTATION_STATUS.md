# Multiplayer implementation status

Validates code against `MULTIPLAYER_PLAN.md` and tracks what ships next.

**Last update:** 2026-08-13

---

## Design validation (Layer M)

| Plan epic | Status | Notes / flaws fixed |
|-----------|--------|---------------------|
| **M0** Spec numbers | **Done** | `marketSim.ts` + plan table |
| **M1** Customer / under-over serve | **Done** | Category serve mul on stalls |
| **M2** NPC livelihood / homeless | **Done** | Rent fail → homeless; hire/gift rescue |
| **M3** Affinity → sales + rate limits | **Done** | Standing/affinity in demand; 60s/30s cools |
| **M4** Dialogue + rare backstory | **Done** | Extra drama lines + ~10% hooks |
| **M5** HUD sales drivers | **Done** | Stall panel + sale toasts |
| **Labor / housing** (post-plan) | **Done** | Soft ~25–30 humans; housing expands supply |
| **M6** Mode adapters | **Scaffold** | `sim/mode.ts` — SP uses solo; co-op/comp views ready |
| **M7** Balance pass | **Partial** | Needs dedicated MP playtest |
| **M8** P2P plot/stall/poach | **Not started** | Comp Path B |

### Flaws found and addressed (this pass)

1. **Economy not hostable** — huge `economy.ts` is client-bound. **Mitigation:** pure formulas in `marketSim`, `laborMarket`, `sim/*` for Node reuse; full inv authority still client-side until Path A.
2. **No ownership mode** — added `sim/mode.ts` (solo / team / player).
3. **No wire protocol** — added `sim/protocol.ts` + `tools/mp-server.mjs` + `mpClient.ts`.
4. **Baseline table in plan was stale** — market/labor deeper than “abstract ticks”; plan baseline still says old line (doc debt).

### Remaining design risks

| Risk | Impact | Next fix |
|------|--------|----------|
| SP economy runs only on client | Cheating in comp; desync in co-op | Path A: room-authoritative `InventoryState` ticks |
| Stall under/over is city-wide not per-plaza | Comp plaza wars weaker | M1 refine: district-local serve counts |
| Labor market is human-only | Robots bypass housing | Intentional for now; document |
| P2P markets missing | Comp fantasy incomplete | M8 after presence works |

---

## Layer N (this slice)

| Piece | Status |
|-------|--------|
| Room create / join code | **Done** (mp-server) |
| Modes coop \| comp flag | **Done** (label only; economy still SP) |
| Presence poses + remotes | **Done** (cyan capsules + nameplates) |
| Personal home pads (9) | **Spawn coords only** (not full pad ownership yet) |
| Team / private inv | **Not started** |
| Tunnel ops | Same as accounts (`cloudflared`) |

---

## Recommended order (unchanged)

1. Finish presence playtests (this slice)  
2. Path A: co-op shared inv authority on mp-server  
3. Path B: N wallets + M8 P2P  

---

## Your ops checklist

See end of agent reply / `docs/ACCOUNTS_HOME.md` pattern for tunnels.
