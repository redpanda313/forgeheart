# ForgeHeart — Secure Player Accounts & Authoritative Economy

**Status:** Planning — deferred implementation  
**Product:** ForgeHeart (browser Three.js; workshop → market training → empire sky city)  
**Related:** `docs/SKY_EMPIRE_ECONOMY_DESIGN.md` (always-on city, brass + aether, server-authoritative inventory)  
**Out of scope for this plan:** Cryptocurrency, blockchains, open token markets  

---

## 1. Purpose

Players must be able to:

1. **Create an account** and **log in** on any device (desktop or mobile browser).  
2. Keep **multiple save files** bound to that account (same mental model as today’s 3 local slots).  
3. **Continue any slot** after logging in elsewhere.  
4. Trust that **all in-game economic value** cannot be trivially hacked, duplicated, or rolled back by editing client storage or replaying requests.

**Clarification:** “In-game resources” means **all** gameplay currencies and inventory of economic value — not only late-game rares. That includes at least:

| Asset class | Examples (current / planned) |
|-------------|------------------------------|
| Currencies | **Brass**, **aether** |
| Commodities | Scrap brass, cloud iron, wire, frames, kits, reef mats, inventions stock, etc. |
| Progression entitlements with economic weight | Apartment deed, bay/workshop lease, stall ownership, board + upgrades, worker hires (as owned state) |

Cosmetic-only or purely narrative flags may remain in the save blob if they cannot mint value. When in doubt, put it on the server.

---

## 2. Current state (baseline)

| Area | Today |
|------|--------|
| Identity | None — browser-local only |
| Saves | 3 slots in `localStorage` (`src/forgeheart/save.ts`) |
| Economy | Client-side `InventoryState` in `economy.ts`; brass/aether/items live inside save JSON |
| Trust model | **Fully client-trusted** — DevTools / save edit can set any balance |
| Cross-device | Impossible without manual export |

This is fine for a single-player slice. It is **not** acceptable once accounts, cross-device play, or real-money convenience purchases exist.

---

## 3. Goals & non-goals

### 3.1 Goals

- Account create / login / logout / session restore.  
- Cloud save slots owned by `user_id`.  
- **Server-authoritative** brass, aether, and inventory quantities.  
- Anti-dupe: idempotent grants, optimistic concurrency, append-only ledger.  
- Migration path from existing local slots.  
- Mobile + desktop browsers equally supported.  
- Design that later supports multiplayer city shards without a second identity system.

### 3.2 Non-goals (this document)

- Building or integrating a blockchain / crypto wallet.  
- Full realtime multiplayer authority (combat AOI, etc.) — only identity + persistence + economy writes.  
- Putting every animation frame or camera pose on the server.  
- Replacing the Three.js client.

### 3.3 Success criteria

- Editing `localStorage` cannot increase server brass/aether/items after login.  
- Two devices cannot double-apply the same purchase or harvest payout.  
- Player can log in on phone and desktop and see the same slots and balances.  
- Support can audit “why did this wallet change?” via ledger rows.

---

## 4. Top recommendation

**Managed auth + Postgres + thin authoritative API + append-only economy ledger.**

| Layer | Recommendation | Rationale |
|-------|----------------|-----------|
| Auth | **Supabase Auth** (magic link + Google/Apple) *or* Clerk + hosted Postgres | Fast, MFA-capable later, browser-friendly |
| Database | **Postgres** (Supabase or Neon) | Relational wallets, unique constraints, transactions |
| API | **Edge Functions** / small Worker or Node API using **service role** for wallet writes | Clients never get direct UPDATE on balances |
| Saves | `save_slots` rows (JSON payload + `revision`) | Cross-device continuity |
| Economy | `wallets` + `inventory` + `ledger` | Brass **and** aether treated identically for integrity |
| Client | Existing game; add `cloud.ts` + title-screen auth UI | Minimal rewrite of rendering |

**Why not “client saves only with encryption”?**  
Encryption obscures casual tampering; it does not stop a modified client from sending a rich save. Only **server-side mutation rules** protect value.

**Why not a game-specific blockchain?**  
Deferred permanently for this plan. A normal ledger with service-only writes matches a closed in-game economy and is cheaper and clearer for accounts.

---

## 5. Security model

### 5.1 Trust boundary

```
┌─────────────────────────────────────────┐
│  Browser (untrusted)                    │
│  - rendering, input, prediction         │
│  - may cache display copies of balances │
│  - MUST NOT be source of truth          │
└─────────────────┬───────────────────────┘
                  │ HTTPS + session JWT
                  ▼
┌─────────────────────────────────────────┐
│  API (trusted)                          │
│  - validates session                    │
│  - validates game actions               │
│  - writes ledger + wallets in one txn   │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Postgres (source of truth)             │
│  - users, slots, wallets, inventory     │
│  - append-only ledger                   │
└─────────────────────────────────────────┘
```

### 5.2 Hard rules

1. **No client writes** to `wallets`, `inventory`, or `ledger` (RLS deny-all for those tables from the anon/authenticated key; only server/service role writes).  
2. Client sends **intents** (`action_type` + params + `idempotency_key`), not “set brass = 99999”.  
3. Every balance change inserts a **ledger row** and updates aggregates in the **same DB transaction**.  
4. **Idempotency:** `UNIQUE (user_id, idempotency_key)` so retries and dual-device taps cannot double-credit.  
5. **Save revision:** `UPDATE save_slots SET … WHERE user_id AND slot AND revision = $expected`; on conflict, return 409 and let the client reload.  
6. **Authoritative assets are not trusted inside save JSON.** Payload may mirror balances for offline UI, but on sync the server overwrites mirrors from `wallets` / `inventory`.  
7. Rate-limit auth, saves, and economy actions per user/IP.  
8. Real-money grants (if any): **payment webhook → ledger credit only** (never trust the client “I paid”).

### 5.3 Threats & mitigations

| Threat | Mitigation |
|--------|------------|
| Edited local save / memory | Server ignores client balances; applies only validated actions |
| Replay of “harvest success” | Idempotency keys; server-side cooldowns / run tokens |
| Two devices overwrite saves | Slot `revision`; optional “conflict” UI |
| Two devices double-claim payout | Ledger unique constraint + transactional updates |
| Stolen session cookie/JWT | Short-lived access token; refresh rotation; logout-all |
| Account takeover via email | Verified email; rate limits; optional MFA later |
| Rollback to old rich save | Wallet/inventory independent of slot payload history |
| Insider / buggy function mints value | Ledger audit; staging tests; least-privilege keys; alerts on large deltas |

### 5.4 Offline & single-player UX

Pick one policy early (recommend **A** for security):

| Policy | Behavior |
|--------|----------|
| **A. Online-required for economy** | Can walk/explore offline from cache; harvest/craft/sell/buy require server ack |
| **B. Offline queue** | Queue intents; flush on reconnect — higher dupe risk; needs careful design |
| **C. Guest local** | Logged-out play stays fully local and **non-transferable**; login required to cloud-attach |

**Recommendation:** **C** for casual try-before-login + **A** once an account session is active.

---

## 6. Data model

### 6.1 Tables (v1)

```sql
-- Auth users: provided by Supabase auth.users (or Clerk user id as text)

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.save_slots (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_index smallint not null check (slot_index between 0 and 2),
  revision bigint not null default 1,
  -- Progress / presentation only — not trusted for balances
  payload jsonb not null default '{}',
  level_id text,
  level_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_index)
);

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brass bigint not null default 0 check (brass >= 0),
  aether bigint not null default 0 check (aether >= 0),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  qty bigint not null default 0 check (qty >= 0),
  primary key (user_id, item_id)
);

create table public.ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,          -- 'brass' | 'aether' | item_id
  delta bigint not null,        -- signed
  balance_after bigint,         -- optional snapshot for audits
  reason text not null,         -- 'harvest', 'craft', 'stall_sale', 'purchase', ...
  slot_index smallint,          -- optional context
  idempotency_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index ledger_user_created on public.ledger (user_id, created_at desc);

-- Entitlements that gate economy (deeds, leases) — server-owned flags
create table public.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,            -- 'apartment', 'parcel_leased', 'stall', 'city_workshop', ...
  value jsonb not null default 'true',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
```

### 6.2 What stays in `save_slots.payload`

Safe examples:

- `levelId`, tutorial phase, camera mode, backstory seed  
- Health/plasma if not economically tradable  
- UI prefs, look sensitivity (or keep local)  
- Non-valuable narrative flags  

Must **not** be authoritative (may be omitted or overwritten on load):

- `brass`, `aether`, `items`, shelf stock counts  
- Ownership flags that unlock paid/progress gates (prefer `entitlements`)

### 6.3 Mapping from current client types

| Client today | Server |
|--------------|--------|
| `ForgeSaveData` / slot JSON | Mostly `save_slots.payload` + metadata columns |
| `economy.brass` / top-level `brass` | `wallets.brass` |
| `economy.aether` | `wallets.aether` |
| `economy.items` | `inventory` rows |
| `apartmentOwned`, leases, stall | `entitlements` |
| `playerBoard`, workers (complex) | Phase 2+: normalize or store as server-validated JSON under `entitlements` / `player_state` with **no client-set quantities for sellable goods** |

Complex nested state (workers, programs, custom recipes) can begin as **server-validated JSON documents** keyed by user, as long as mutations go through API validators—not raw client uploads of “I invented a free money recipe.”

---

## 7. API surface (v1)

All authenticated unless noted.

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/*` | Handled by provider (magic link, OAuth) |
| `GET /me` | Profile + wallet summary |
| `GET /slots` | List 3 slots (metadata + optional lightweight preview) |
| `GET /slots/:i` | Full payload + **canonical** wallet/inventory/entitlements |
| `PUT /slots/:i` | Save progress payload with `revision` |
| `POST /economy/action` | Body: `{ type, params, idempotency_key, slot_index? }` |
| `POST /account/migrate-local` | One-time upload of local slots (see §9) |
| `POST /account/logout-all` | Revoke refresh sessions |

### 7.1 Economy action types (initial set)

Prioritize by economic impact:

1. `harvest_payout`  
2. `craft`  
3. `market_buy` / `market_sell`  
4. `stall_sale` (NPC buy from player shelf)  
5. `lease_parcel` / `expand_bay` / `buy_apartment`  
6. `board_purchase` / upgrade parts  
7. `hire_worker` / wage upkeep (tick may be server-scheduled later)  
8. `aether_grant` (store webhook only)

Each handler: validate → compute delta → ledger insert → update wallet/inventory/entitlements → return new canonical state.

---

## 8. Client integration plan

### 8.1 Title screen

- **Log in / Create account**  
- When logged in: show **cloud** slots (labels from server)  
- When logged out: optional **local guest** slots (current behavior) with banner: “Log in to play across devices”  
- After login with local data: **Migrate local saves?** (once)

### 8.2 Runtime

- On load slot: merge server wallet/inventory into `InventoryState`.  
- On economy mutation: await API (or optimistic UI with rollback on failure).  
- Autosave: send payload **without** trusting balances; server may strip money fields.  
- Pause menu: account email, log out, sync status.

### 8.3 Suggested modules

| Module | Role |
|--------|------|
| `src/forgeheart/cloud/auth.ts` | Session, login UI hooks |
| `src/forgeheart/cloud/saves.ts` | Slot list/load/save |
| `src/forgeheart/cloud/economy.ts` | `postAction`, apply canonical state |
| `src/forgeheart/cloud/migrate.ts` | Local → cloud one-shot |
| Keep `save.ts` | Local guest + cache |

---

## 9. Local → cloud migration

1. User logs in.  
2. If cloud slots empty and local slots exist → modal: Upload / Skip.  
3. Upload sends payloads; server creates wallets from **max** or **sum-with-cap**?  

**Recommended migration policy (anti-abuse):**

- Create wallet from the **primary chosen slot’s** brass/aether/items (player picks which local slot is canonical), **or**  
- Take the **maximum brass** among local slots and inventory from that same slot only (not sum of all three — summing enables triplication).

4. Set entitlement `migration_v1_done`. Never re-sum local into cloud.

---

## 10. Phased delivery

### Phase 0 — Spec lock (this doc)

- [x] Recommend stack and trust model  
- [ ] Choose Supabase vs Clerk+Neon (default lean: **Supabase**)  
- [ ] Confirm offline policy **A + guest C**  
- [ ] Confirm migration anti-dupe rule (single canonical slot)

### Phase 1 — Auth + cloud slots (no economy authority yet)

**Deliverable:** Login works; 3 slots sync across devices; progress only.

- Supabase project, auth providers, `profiles`, `save_slots`  
- Title UI login  
- `GET/PUT` slots with revision  
- Local cache still optional  

**Risk note:** Until Phase 2, balances in payload remain cheatible—do not market “secure economy” yet.

### Phase 2 — Authoritative wallet & inventory

**Deliverable:** Brass, aether, items server-owned.

- Tables: `wallets`, `inventory`, `ledger`, `entitlements`  
- Strip trusted balances from slot writes  
- Port highest-value actions first (apartment, harvest, craft, market, stall)  
- Client displays only server-returned balances after each action  

### Phase 3 — Full action coverage & hardening

- Remaining economy ops and entitlement mutations  
- Stripe (or similar) webhook for aether convenience packs  
- Rate limits, anomaly alerts, admin audit view  
- Session revoke / MFA optional  
- Load tests on save + action endpoints  

### Phase 4 — Multiplayer readiness (future)

- Same `user_id` joins city shard  
- Trading = dual ledger entries in one txn  
- No second inventory system  

---

## 11. Stack options (decision record)

### 11.1 Default: Supabase (recommended start)

| Pros | Cons |
|------|------|
| Auth + DB + Edge Functions in one place | Must lock RLS carefully |
| Fast path to Phase 1 | Vendor coupling |
| Generous free tier for prototyping | Cold starts on functions |

**RLS sketch:** authenticated users `SELECT` own `save_slots`, `wallets`, `inventory`; **no** `INSERT/UPDATE/DELETE` on wallet/inventory/ledger for authenticated role. Functions use service role.

### 11.2 Alternative: Clerk + Neon + Cloudflare Workers

| Pros | Cons |
|------|------|
| Excellent auth UX | More moving parts |
| Flexible API host | Slightly longer Phase 1 |

Use if the team already standardizes on Clerk.

---

## 12. Most secure vs most economical (closed economy)

*Blockchain excluded by product decision.*

| | **Most secure** | **Most economical (still acceptable)** |
|--|-----------------|----------------------------------------|
| Description | Dedicated API, Postgres ledger, all economy actions online, MFA, anomaly jobs, payment webhooks | Supabase Auth + Edge Functions + ledger; guest local allowed |
| Brass / aether / items | Identical authority | Identical authority |
| Cost | Higher ops & eng time | Lower; free tier then scales |
| Benefits | Best auditability; MP-ready; hardest to dupe | Ships accounts+security fastest |
| Drawbacks | Slower to first login feature | RLS mistakes can be catastrophic—needs review checklist |
| **This plan’s pick** | Phase 3–4 hardening | **Phases 1–2 on Supabase** |

**Hybrid (chosen):** Economical hosting/auth (**Supabase**), secure **semantics** (ledger + no client wallet writes) from Phase 2 onward. Brass is not a second-class “soft” currency for security purposes.

---

## 13. Operational checklist (before calling economy “secure”)

- [ ] RLS verified: authenticated role cannot `UPDATE wallets`  
- [ ] Service role key only on server; never shipped to client  
- [ ] Idempotency enforced in DB unique constraint  
- [ ] Save revision conflicts handled in UI  
- [ ] Migration cannot be repeated to multiply brass  
- [ ] Webhook signatures verified for any IAP/Stripe  
- [ ] Backups + point-in-time recovery enabled on Postgres  
- [ ] Basic alerting: brass delta &gt; threshold / hour  

---

## 14. Testing plan

| Test | Expect |
|------|--------|
| Login on device A, save, login device B | Same slots and balances |
| Edit client brass, reload from server | Server value wins |
| Replay same `idempotency_key` | One credit only |
| Two tabs save different revisions | One 409; no silent clobber |
| Migrate three rich local slots | No 3× brass (canonical slot policy) |
| Logged-out guest | Local only; cannot write to another user’s cloud |

---

## 15. Open questions (resolve when implementation starts)

1. Supabase vs Clerk+Neon — default Supabase unless overridden.  
2. Are **workers / programs / custom recipes** Phase 2 JSON docs or fully normalized tables?  
3. Soft wipe / season tags (`SKY_EMPIRE_ECONOMY_DESIGN.md`) — add `season_id` on wallets later?  
4. Display names / uniqueness / moderation.  
5. Whether guest progress can be merged after first login only within N days.

---

## 16. Getting started (first engineering week)

When this work is picked up:

1. Create Supabase project; enable email magic link (+ Google if keys ready).  
2. Apply SQL from §6.1 (slots first; wallets in same migration if tackling Phase 2 immediately).  
3. Add `src/forgeheart/cloud/*` and title-screen login.  
4. Implement `GET/PUT /slots` with revision.  
5. Prove phone ↔ desktop slot sync.  
6. Only then: wallet tables + one `economy/action` (e.g. harvest payout) end-to-end.  
7. Freeze migration policy in UI copy and server flag `migration_v1_done`.

---

## 17. Document history

| Date | Note |
|------|------|
| 2026-07-20 | Initial plan: secure accounts, cloud saves, authoritative **in-game** resources (brass = aether for integrity). No crypto. |

---

## 18. Summary

**Do this:** Supabase (or equivalent) accounts, cloud save slots, Postgres wallets/inventory, append-only ledger, server-validated actions.  

**Treat brass and all valuable inventory like aether.**  

**Do not:** trust `localStorage`, sum-migrate all local slots, or put mint authority in the client.  

**Come back to this file** when ready to implement Phase 1.
