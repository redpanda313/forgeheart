# Play ForgeHeart (easy share)

## One-click (best for friends)

**Live game:** https://redpanda313.github.io/forgeheart/

1. Open the link in Chrome, Firefox, Safari, or Edge  
2. Click **NEW GAME** (or **CONTINUE** if they already played on that browser)  
3. Click the game once to lock the mouse, then play  

No install. No Node. No download.

> First deploy: after GitHub Pages is enabled (Settings → Pages → Source: **GitHub Actions**), the link goes live within a minute of pushing to `main`.

---

## Play on your machine (developers)

```bash
git clone https://github.com/redpanda313/forgeheart.git
cd forgeheart
npm install
npm run dev
```

Open **http://localhost:5180**

On macOS you can also double-click `tools/launch/Launch ForgeHeart.command`.

---

## Controls (basics)

| Action | Input |
|--------|--------|
| Move / look | WASD + mouse |
| Jump / interact | Space / E |
| Board | Mount at board spots; surf sky lanes |
| Pause / save | Esc |
| City map | M (in mega-city) |

### Mobile browser

On phones and tablets, ForgeHeart shows on-screen controls automatically:

| Action | Control |
|--------|---------|
| Move | Left virtual stick |
| Look | Drag anywhere on the screen |
| Jump / interact / attack | JMP · E · ATK |
| Slide / board mount | SLD · Q |
| Weapons / map / bay / pause | 1–3 · M · I · ☰ |

---

## Share a ZIP (offline / no GitHub Pages)

```bash
npm run build
# zip the dist folder and send it
```
