/**
 * ForgeHeart: Gift of the Brass Gods
 * https://github.com/redpanda313/forgeheart
 */

import './styles.css';
import { ForgeHeartGame } from './forgeheart/game';
import { isMobileBrowser } from './forgeheart/mobileInput';
import {
  listSlots,
  getLastSlotIndex,
  formatLevelProgress,
  applyCloudSlotsToLocal,
  type ForgeSaveData,
} from './forgeheart/save';
import {
  getAccountApiUrl,
  setAccountApiUrl,
  loadAccountApiConfig,
  getSession,
  isLoggedIn,
  loginAccount,
  registerAccount,
  logoutAccount,
  fetchCloudSlots,
  pingAccountServer,
  migrateLocalSlotsToEmptyCloud,
} from './forgeheart/accounts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const titleScreen = document.getElementById('title-screen')!;
const hud = document.getElementById('hud')!;
const btnNew = document.getElementById('btn-new-game') as HTMLButtonElement;
const btnContinue = document.getElementById('btn-continue') as HTMLButtonElement;
const saveInfo = document.getElementById('save-info')!;
const slotsEl = document.getElementById('save-slots')!;
const pauseMenu = document.getElementById('pause-menu');
const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
const btnResume = document.getElementById('btn-resume') as HTMLButtonElement | null;
const btnTitle = document.getElementById('btn-title') as HTMLButtonElement | null;

const accountApiUrl = document.getElementById('account-api-url') as HTMLInputElement | null;
const accountUsername = document.getElementById('account-username') as HTMLInputElement | null;
const accountPassword = document.getElementById('account-password') as HTMLInputElement | null;
const accountStatus = document.getElementById('account-status');
const accountMsg = document.getElementById('account-msg');
const btnLogin = document.getElementById('btn-account-login') as HTMLButtonElement | null;
const btnRegister = document.getElementById('btn-account-register') as HTMLButtonElement | null;
const btnLogout = document.getElementById('btn-account-logout') as HTMLButtonElement | null;
const btnPing = document.getElementById('btn-account-ping') as HTMLButtonElement | null;

let game: ForgeHeartGame | null = null;
let running = false;
let mouseWired = false;
/** Selected slot on title (0–2) */
let selectedSlot = getLastSlotIndex() ?? 0;
/** Cloud slots loaded (when logged in); null = use local only */
let cloudMode = false;

function setAccountMsg(text: string, kind: '' | 'ok' | 'error' = '') {
  if (!accountMsg) return;
  accountMsg.textContent = text;
  accountMsg.classList.remove('ok', 'error');
  if (kind) accountMsg.classList.add(kind);
}

function syncAccountChrome() {
  const session = getSession();
  const logged = !!session;
  if (accountStatus) {
    accountStatus.textContent = logged
      ? `logged in · ${session!.username}`
      : 'guest · this browser only';
    accountStatus.classList.toggle('online', logged);
  }
  btnLogout?.classList.toggle('hidden', !logged);
  btnLogin?.classList.toggle('hidden', logged);
  btnRegister?.classList.toggle('hidden', logged);
  if (accountUsername) accountUsername.disabled = logged;
  if (accountPassword) accountPassword.disabled = logged;
  // Always keep the field filled from resolved URL (localStorage / site config / localhost)
  if (accountApiUrl) {
    const resolved = getAccountApiUrl();
    if (resolved && accountApiUrl.value.trim() !== resolved) {
      accountApiUrl.value = resolved;
    } else if (!accountApiUrl.value.trim() && resolved) {
      accountApiUrl.value = resolved;
    }
  }
}

function refreshSlots() {
  const slots = listSlots();
  const last = getLastSlotIndex();
  slotsEl.innerHTML = '';
  for (const s of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'save-slot' + (s.empty ? ' empty' : '') + (s.index === selectedSlot ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'slot-name';
    name.textContent = s.empty ? `Slot ${s.index + 1} — Empty` : s.label;
    const meta = document.createElement('span');
    meta.className = 'slot-meta';
    if (s.data) {
      meta.textContent = `${s.sublabel} · ${formatLevelProgress(s.data)}`;
    } else {
      meta.textContent = cloudMode
        ? 'Cloud empty · New Game uses this slot'
        : 'New game will use this slot';
    }
    btn.appendChild(name);
    btn.appendChild(meta);
    btn.addEventListener('click', () => {
      selectedSlot = s.index;
      refreshSlots();
      updateContinueButton();
    });
    slotsEl.appendChild(btn);
  }

  if (last != null && slots[last] && !slots[last]!.empty && selectedSlot !== last) {
    // keep user selection
  }
  updateContinueButton();
}

function updateContinueButton() {
  const slots = listSlots();
  const selected = slots[selectedSlot];
  const last = getLastSlotIndex();

  if (selected && !selected.empty && selected.data) {
    btnContinue.classList.remove('hidden');
    const lastTag = last === selectedSlot ? ' · last played' : '';
    const cloudTag = cloudMode ? ' · cloud' : '';
    btnContinue.textContent = `CONTINUE — Slot ${selectedSlot + 1} · ${selected.data.levelName}${lastTag}${cloudTag}`;
  } else {
    btnContinue.classList.add('hidden');
  }

  if (selected?.empty) {
    btnNew.textContent = `NEW GAME (Slot ${selectedSlot + 1})`;
    saveInfo.textContent = cloudMode
      ? `Slot ${selectedSlot + 1} empty on account · New Game starts workshop (saves to cloud)`
      : `Slot ${selectedSlot + 1} is empty · New Game starts Voss Workshop`;
  } else if (selected?.data) {
    btnNew.textContent = `NEW GAME (overwrite Slot ${selectedSlot + 1})`;
    saveInfo.textContent = `Selected Slot ${selectedSlot + 1}: ${selected.label} · Continue loads this save${cloudMode ? ' (cloud)' : ''}`;
  } else {
    btnNew.textContent = 'NEW GAME';
    saveInfo.textContent = 'Select a slot · New Game or Continue for that slot';
  }
  saveInfo.classList.remove('hidden');
}

function loop() {
  if (!running || !game) return;
  game.update();
  if (pauseMenu) {
    if (game.isPaused()) pauseMenu.classList.remove('hidden');
    else pauseMenu.classList.add('hidden');
  }
  requestAnimationFrame(loop);
}

function wireMouse() {
  if (mouseWired) return;
  mouseWired = true;
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) game?.setFireHeld(true);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) game?.setFireHeld(false);
  });
}

async function startGame(opts: { slot: number; save: ForgeSaveData | null }) {
  titleScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  pauseMenu?.classList.add('hidden');

  if (game) {
    try {
      game.dispose?.();
    } catch {
      /* ignore */
    }
    game = null;
  }

  game = new ForgeHeartGame(canvas, { slot: opts.slot, save: opts.save });
  wireMouse();
  await game.start();
  running = true;
  requestAnimationFrame(loop);
}

/**
 * Fetch cloud slots, migrate any local device saves into empty account slots,
 * then mirror the result into localStorage for play.
 */
async function syncCloudAfterAuth(baseMsg: string) {
  // Snapshot local BEFORE cloud apply (empty cloud used to wipe device saves)
  const localSnapshot = listSlots().map((s) => ({
    index: s.index,
    empty: s.empty,
    data: s.data,
  }));
  const localCount = localSnapshot.filter((s) => !s.empty && s.data).length;

  const cloud = await fetchCloudSlots();
  if (!cloud.ok) {
    setAccountMsg(cloud.msg, 'error');
    cloudMode = false;
    refreshSlots();
    return;
  }

  let slots = cloud.slots;
  let migrateNote = '';
  const cloudEmptyCount = slots.filter((s) => s.empty || !s.data).length;
  if (localCount > 0 && cloudEmptyCount > 0) {
    setAccountMsg('Migrating local saves to your account…');
    const mig = await migrateLocalSlotsToEmptyCloud(slots, localSnapshot);
    slots = mig.slots;
    if (mig.migrated > 0) {
      migrateNote = ` · migrated ${mig.migrated} local slot${mig.migrated === 1 ? '' : 's'} to account`;
    }
    if (mig.failed > 0) {
      migrateNote += ` · ${mig.failed} migrate failed`;
    }
  }

  // Cloud is source of truth for occupied slots; empty cloud keeps empty local
  applyCloudSlotsToLocal(slots);
  cloudMode = true;
  selectedSlot = getLastSlotIndex() ?? 0;
  refreshSlots();
  const used = slots.filter((s) => !s.empty && s.data).length;
  setAccountMsg(`${baseMsg}${migrateNote} · ${used}/3 slots used`, 'ok');
}

async function afterAuthSuccess(msg: string) {
  setAccountMsg(msg, 'ok');
  syncAccountChrome();
  await syncCloudAfterAuth(msg);
}

function readAuthForm(): { username: string; password: string; apiUrl: string } | null {
  if (accountApiUrl) {
    setAccountApiUrl(accountApiUrl.value);
  }
  const username = accountUsername?.value ?? '';
  const password = accountPassword?.value ?? '';
  if (!username.trim()) {
    setAccountMsg('Enter a username (any non-empty text).', 'error');
    return null;
  }
  if (!getAccountApiUrl()) {
    setAccountMsg('Set the account server URL first (home PC tunnel or localhost).', 'error');
    return null;
  }
  return { username: username.trim(), password, apiUrl: getAccountApiUrl() };
}

btnLogin?.addEventListener('click', () => {
  void (async () => {
    const form = readAuthForm();
    if (!form) return;
    setAccountApiUrl(form.apiUrl); // remember for next visit
    setAccountMsg('Logging in…');
    const r = await loginAccount(form.username, form.password);
    if (!r.ok) {
      setAccountMsg(r.msg, 'error');
      return;
    }
    await afterAuthSuccess(r.msg);
  })();
});

btnRegister?.addEventListener('click', () => {
  void (async () => {
    const form = readAuthForm();
    if (!form) return;
    setAccountApiUrl(form.apiUrl);
    setAccountMsg('Creating account…');
    const r = await registerAccount(form.username, form.password);
    if (!r.ok) {
      setAccountMsg(r.msg, 'error');
      return;
    }
    await afterAuthSuccess(r.msg);
  })();
});

btnLogout?.addEventListener('click', () => {
  void (async () => {
    await logoutAccount();
    cloudMode = false;
    syncAccountChrome();
    setAccountMsg('Logged out · slots below are this browser only.', 'ok');
    refreshSlots();
  })();
});

btnPing?.addEventListener('click', () => {
  void (async () => {
    if (accountApiUrl) setAccountApiUrl(accountApiUrl.value);
    setAccountMsg('Pinging server…');
    const r = await pingAccountServer();
    if (r.ok && accountApiUrl?.value) setAccountApiUrl(accountApiUrl.value);
    setAccountMsg(r.msg, r.ok ? 'ok' : 'error');
  })();
});

accountApiUrl?.addEventListener('change', () => {
  setAccountApiUrl(accountApiUrl.value);
});

btnNew.addEventListener('click', () => {
  const slots = listSlots();
  const s = slots[selectedSlot];
  if (s && !s.empty) {
    const ok = window.confirm(
      `Overwrite Slot ${selectedSlot + 1} (“${s.label}”) with a new game at Voss Workshop?`,
    );
    if (!ok) return;
  }
  void startGame({ slot: selectedSlot, save: null });
});

btnContinue.addEventListener('click', () => {
  const slots = listSlots();
  const slot = slots[selectedSlot];
  const data = slot?.data;
  if (!slot || slot.empty || !data) {
    saveInfo.textContent = `Slot ${selectedSlot + 1} is empty — select a save or start a New Game.`;
    saveInfo.classList.remove('hidden');
    return;
  }
  void startGame({ slot: selectedSlot, save: data });
});

btnSave?.addEventListener('click', () => {
  if (!game) return;
  game.saveProgress();
  game.toastPublic?.(
    isLoggedIn() ? 'Progress saved (local + cloud).' : 'Progress saved (this browser).',
  );
});

btnResume?.addEventListener('click', () => {
  game?.setPaused(false);
  pauseMenu?.classList.add('hidden');
});

document.getElementById('market-close')?.addEventListener('click', () => {
  (game as { closeMarketPublic?: () => void } | null)?.closeMarketPublic?.();
});

document.getElementById('craft-close')?.addEventListener('click', () => {
  (game as { closeCraftPublic?: () => void } | null)?.closeCraftPublic?.();
});

document.getElementById('bay-close')?.addEventListener('click', () => {
  (game as { closeBayPublic?: () => void } | null)?.closeBayPublic?.();
});

document.getElementById('board-close')?.addEventListener('click', () => {
  (game as { closeBoardPublic?: () => void } | null)?.closeBoardPublic?.();
});

document.getElementById('program-close')?.addEventListener('click', () => {
  (game as { closeProgramPublic?: () => void } | null)?.closeProgramPublic?.();
});

document.getElementById('stall-close')?.addEventListener('click', () => {
  (game as { closeStallPublic?: () => void } | null)?.closeStallPublic?.();
});

document.getElementById('stall-wizard-cancel')?.addEventListener('click', () => {
  (game as { cancelStallWizardPublic?: () => void } | null)?.cancelStallWizardPublic?.();
});
document.getElementById('stall-wizard-back')?.addEventListener('click', () => {
  (game as { stallWizardBackPublic?: () => void } | null)?.stallWizardBackPublic?.();
});
document.getElementById('stall-wizard-next')?.addEventListener('click', () => {
  (game as { stallWizardNextPublic?: () => void } | null)?.stallWizardNextPublic?.();
});

document.getElementById('program-new')?.addEventListener('click', () => {
  (game as { newProgramPublic?: () => void } | null)?.newProgramPublic?.();
});

document.getElementById('program-templates')?.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement | null)?.closest?.(
    '[data-program-template]',
  ) as HTMLElement | null;
  const id = t?.dataset.programTemplate;
  if (!id) return;
  (game as { newProgramFromTemplatePublic?: (id: string) => void } | null)?.newProgramFromTemplatePublic?.(
    id,
  );
});

document.querySelectorAll('[data-bay-tab]').forEach((el) => {
  el.addEventListener('click', () => {
    const tab = (el as HTMLElement).dataset.bayTab;
    if (tab) {
      (game as { setBayTabPublic?: (t: string) => void } | null)?.setBayTabPublic?.(tab);
    }
  });
});

document.getElementById('bay-open-programs')?.addEventListener('click', () => {
  (game as { openProgramPublic?: () => void } | null)?.openProgramPublic?.();
});

btnTitle?.addEventListener('click', () => {
  if (!game) return;
  const ok = window.confirm('Return to title? Unsaved progress will be lost unless you Save first.');
  if (!ok) return;
  game.saveProgress();
  game.setPaused(false);
  try {
    game.dispose?.();
  } catch {
    /* ignore */
  }
  game = null;
  running = false;
  for (const id of [
    'bay-panel',
    'craft-panel',
    'market-panel',
    'board-panel',
    'storage-panel',
    'program-panel',
    'stall-panel',
    'stall-wizard',
    'harvest-overlay',
    'maker-palette',
    'maker-hud',
    'nav-compass',
    'mobile-controls',
    'shop-panel',
    'city-map-panel',
    'romance-panel',
    'neighbor-panel',
    'lease-office-panel',
    'garden-plant-panel',
  ]) {
    const el = document.getElementById(id);
    el?.classList.add('hidden');
    el?.setAttribute('aria-hidden', 'true');
  }
  hud.classList.add('hidden');
  pauseMenu?.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  void bootstrapTitle();
});

const mobileHint = document.getElementById('mobile-title-hint');
if (mobileHint && isMobileBrowser()) {
  mobileHint.classList.remove('hidden');
  mobileHint.setAttribute('aria-hidden', 'false');
}

async function bootstrapTitle() {
  // Auto-fill server URL from localStorage, then public/account-api.json, then localhost
  await loadAccountApiConfig();
  syncAccountChrome();

  const api = getAccountApiUrl();
  if (api) {
    // Remember resolved default so next visit pre-fills even without the json file
    if (accountApiUrl && !localStorage.getItem('forgeheart-account-api-url')) {
      // Don't force-persist bundled URL until user interacts — only show it.
      // Successful login/ping will persist via setAccountApiUrl.
    }
  }

  if (isLoggedIn() && getAccountApiUrl()) {
    setAccountMsg('Restoring cloud slots…');
    await syncCloudAfterAuth(`Cloud ready · ${getSession()?.username ?? 'player'}`);
    if (!cloudMode) {
      if (/Not logged in|Wrong|401/i.test(accountMsg?.textContent || '')) {
        await logoutAccount();
        syncAccountChrome();
      }
    }
  } else {
    cloudMode = false;
    if (!getAccountApiUrl()) {
      setAccountMsg(
        'Guest mode. For cloud saves: run account server at home, tunnel it, put the URL in Server URL (or public/account-api.json).',
      );
    } else {
      setAccountMsg(`Server URL ready · ${getAccountApiUrl()} · create account or log in`, 'ok');
    }
  }
  selectedSlot = getLastSlotIndex() ?? selectedSlot;
  refreshSlots();
}

void bootstrapTitle();

console.info(
  'ForgeHeart',
  '— Gift of the Brass Gods · 3 save slots',
  getAccountApiUrl() ? `· account API ${getAccountApiUrl()}` : '· set account server URL to enable cloud',
);
