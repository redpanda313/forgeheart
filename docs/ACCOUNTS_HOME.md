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

## What you must run (home computer)

Accounts are **not** hosted on GitHub. The static game is. Your Mac runs the login API.

### Every time you want cloud logins to work

**Terminal 1 — account API (leave open)**
```bash
cd /path/to/forgeheart
npm run accounts
```

**Terminal 2 — public tunnel (leave open)**  
Install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

You’ll get a URL like `https://random-words.trycloudflare.com`.

### Auto-fill that URL for all players (recommended once per tunnel)

1. Put the tunnel URL in `public/account-api.json`:
   ```json
   { "url": "https://YOUR-SUBDOMAIN.trycloudflare.com" }
   ```
2. Commit + push `main` (GitHub Pages rebuilds).
3. Title screen **auto-populates Server URL** from that file.

**Note:** free `trycloudflare.com` URLs **change every time** you restart cloudflared.  
When the URL changes: update `account-api.json` and push again, **or** paste once in the title field (browser remembers it).

**Stable URL (best):** Cloudflare named tunnel + your own hostname so you never change the json again.

### Title screen

1. Server URL should already be filled (config file, last visit, or localhost when developing).  
2. **Create account** or **Log in**  
3. Local guest saves migrate into **empty** cloud slots  
4. Pick slot · New Game / Continue  

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
