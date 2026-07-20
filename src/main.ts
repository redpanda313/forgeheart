/**
 * ForgeHeart: Gift of the Brass Gods
 * https://github.com/redpanda313/forgeheart
 */

import './styles.css';
import { ForgeHeartGame } from './forgeheart/game';
import {
  listSlots,
  getLastSlotIndex,
  formatLevelProgress,
  type ForgeSaveData,
} from './forgeheart/save';

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
const btnGameMaker = document.getElementById('btn-game-maker') as HTMLButtonElement | null;
const btnExitMaker = document.getElementById('btn-exit-maker') as HTMLButtonElement | null;

let game: ForgeHeartGame | null = null;
let running = false;
let mouseWired = false;
/** Selected slot on title (0–2) */
let selectedSlot = getLastSlotIndex() ?? 0;

function refreshSlots() {
  const slots = listSlots();
  const last = getLastSlotIndex();
  slotsEl.innerHTML = '';
  for (const s of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'save-slot' + (s.empty ? ' empty' : '') + (s.index === selectedSlot ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'slot-name';
    name.textContent = s.empty ? `Slot ${s.index + 1} — Empty` : s.label;
    const meta = document.createElement('span');
    meta.className = 'slot-meta';
    if (s.data) {
      meta.textContent = `${s.sublabel} · ${formatLevelProgress(s.data)}`;
    } else {
      meta.textContent = 'New game will use this slot';
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

  // Prefer last used if still valid
  if (last != null && slots[last] && !slots[last]!.empty && selectedSlot !== last) {
    // keep user selection if they clicked; only set default once via selectedSlot init
  }
  updateContinueButton();
}

function updateContinueButton() {
  const slots = listSlots();
  const selected = slots[selectedSlot];
  const last = getLastSlotIndex();

  // Continue always loads the *selected* slot (not only last-played)
  if (selected && !selected.empty && selected.data) {
    btnContinue.classList.remove('hidden');
    const lastTag = last === selectedSlot ? ' · last played' : '';
    btnContinue.textContent = `CONTINUE — Slot ${selectedSlot + 1} · ${selected.data.levelName}${lastTag}`;
  } else {
    btnContinue.classList.add('hidden');
  }

  if (selected?.empty) {
    btnNew.textContent = `NEW GAME (Slot ${selectedSlot + 1})`;
    saveInfo.textContent = `Slot ${selectedSlot + 1} is empty · New Game starts Voss Workshop`;
  } else if (selected?.data) {
    btnNew.textContent = `NEW GAME (overwrite Slot ${selectedSlot + 1})`;
    saveInfo.textContent = `Selected Slot ${selectedSlot + 1}: ${selected.label} · Continue loads this save`;
  } else {
    btnNew.textContent = 'NEW GAME';
    saveInfo.textContent = 'Select a slot · New Game or Continue for that slot';
  }
  saveInfo.classList.remove('hidden');
}

function loop() {
  if (!running || !game) return;
  game.update();
  // Sync pause menu visibility
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

  // If a previous game exists, try to clean up
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
  game.toastPublic?.('Progress saved.');
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

document.getElementById('program-new')?.addEventListener('click', () => {
  (game as { newProgramPublic?: () => void } | null)?.newProgramPublic?.();
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

btnGameMaker?.addEventListener('click', () => {
  if (!game) return;
  game.enterGameMaker();
  pauseMenu?.classList.add('hidden');
  syncMakerButtons();
});

btnExitMaker?.addEventListener('click', () => {
  if (!game) return;
  game.exitGameMaker();
  pauseMenu?.classList.add('hidden');
  syncMakerButtons();
});

function syncMakerButtons() {
  const active = game?.isGameMakerActive?.() ?? false;
  if (btnGameMaker) btnGameMaker.classList.toggle('hidden', active);
  if (btnExitMaker) btnExitMaker.classList.toggle('hidden', !active);
}

// Keep pause buttons in sync with maker state
const pauseObserver = () => {
  if (pauseMenu && !pauseMenu.classList.contains('hidden')) syncMakerButtons();
};
setInterval(pauseObserver, 400);

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
  // Ensure no leftover session UI (bay/market/etc.) on title
  for (const id of [
    'bay-panel',
    'craft-panel',
    'market-panel',
    'board-panel',
    'program-panel',
    'stall-panel',
    'harvest-overlay',
    'maker-palette',
    'maker-hud',
    'nav-compass',
  ]) {
    const el = document.getElementById(id);
    el?.classList.add('hidden');
    el?.setAttribute('aria-hidden', 'true');
  }
  hud.classList.add('hidden');
  pauseMenu?.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  refreshSlots();
});

refreshSlots();

console.info(
  '%cForgeHeart',
  'color:#c4a35a;font-size:16px;font-weight:bold',
  '— Gift of the Brass Gods · 3 save slots',
);
