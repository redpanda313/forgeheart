# Lightest home-PC accounts

**Goal:** Username + password, 3 cloud save slots, GitHub Pages client can log in from anywhere while the **account server runs on your home computer**.

No email, no OAuth, no password rules, no username word filters.

---

## Architecture

```
GitHub Pages (static game)  ──HTTPS──►  Cloudflare Tunnel  ──►  your Mac :8787
                                                                account-server.mjs
                                                                data/accounts.json
```

- Client: `src/forgeheart/accounts.ts` + title-screen form  
- Server: `tools/account-server.mjs` (Node only, no npm deps)  
- Store: `data/accounts.json` (gitignored)

---

## Run on your home computer

```bash
# Terminal 1 — account API
npm run accounts

# Terminal 2 — public tunnel (install cloudflared once)
cloudflared tunnel --url http://127.0.0.1:8787
```

Copy the printed `https://….trycloudflare.com` URL.

### Title screen (any browser)

1. Paste that URL into **Server URL**  
2. **Create account** or **Log in** (any username · any password, including empty)  
3. **First login on this device:** local guest saves are uploaded into **empty** account slots (cloud slots that already have a save are never overwritten)  
4. Pick **Slot 1–3** · New Game / Continue  
5. Saves while logged in write **local + cloud**

`Test server` pings `/health`.

---

## Local-only (no tunnel)

```bash
npm run accounts
npm run dev
```

Server URL defaults to `http://127.0.0.1:8787` on localhost.

---

## Optional build-time URL

```bash
VITE_ACCOUNT_API_URL=https://your-tunnel.trycloudflare.com npm run build
```

Players can still override on the title screen (stored in `localStorage`).

---

## API (all CORS `*`)

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/health` | — | — |
| POST | `/register` | — | `{ username, password }` |
| POST | `/login` | — | `{ username, password }` |
| POST | `/logout` | Bearer | — |
| GET | `/me` | Bearer | — |
| GET | `/slots` | Bearer | — |
| PUT | `/slots/0..2` | Bearer | `{ data: ForgeSaveData \| null }` |

Passwords are **scrypt-hashed** on disk (no strength requirements).

---

## Not in this slice

- Email verification, password reset, MFA  
- Server-authoritative brass (client still computes economy; cloud is **save sync** only)  
- Always-on production host (home PC must stay awake + tunnel running)

When you want real anti-cheat economy, graduate to Supabase / hosted API as in `ACCOUNTS_AND_SECURITY.md`.
