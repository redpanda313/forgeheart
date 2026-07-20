/**
 * ForgeHeart — 3 local save slots.
 * Slot display name = level that was saved.
 */

export type LevelId = 'workshop' | 'sky_city' | 'sky_race' | 'mega_city';

export const LEVEL_NAMES: Record<LevelId, string> = {
  workshop: 'Voss Workshop',
  sky_city: 'Sky City Market · Training',
  sky_race: 'Sky City Market · Training', // legacy → same hub
  mega_city: 'Sky City · Home District',
};

export const SLOT_COUNT = 3;
const PREFIX = 'forgeheart-save-slot-';
const LAST_SLOT_KEY = 'forgeheart-last-slot';

export type TutorialPhaseSave =
  | 'explore'
  | 'rebuild'
  | 'siege'
  | 'breach'
  | 'escape'
  | 'won'
  | 'race'
  | 'city';

/** Opaque economy blob — shaped by invToSave / invFromSave */
export interface EconomySaveBlob {
  brass: number;
  aether: number;
  items: Record<string, number>;
  parcelLeased: boolean;
  harvestRuns: number;
  laborerHired?: boolean;
  framesSold?: number;
  repairsDone?: number;
  bayLevel?: number;
  workers?: unknown[];
  playerBoard?: {
    owned?: boolean;
    thruster?: boolean;
    rails?: boolean;
    deck?: boolean;
  };
  customRecipes?: unknown[];
  customStock?: Record<string, number>;
}

export interface ForgeSaveData {
  version: 1;
  levelId: LevelId;
  levelName: string;
  savedAt: number;
  health: number;
  plasma: number;
  brass: number;
  gears: number;
  wrenchUnlocked: boolean;
  bringElias: boolean;
  tutorialPhase: TutorialPhaseSave;
  raceCheckpoint: number;
  raceFinished: boolean;
  boardCamMode?: 'first' | 'third';
  boardOwned?: boolean;
  economy?: EconomySaveBlob;
  backstorySeed?: number;
}

export interface SlotInfo {
  index: number;
  empty: boolean;
  data: ForgeSaveData | null;
  label: string;
  sublabel: string;
}

function slotKey(i: number) {
  return `${PREFIX}${i}`;
}

export function emptySave(levelId: LevelId = 'workshop'): ForgeSaveData {
  return {
    version: 1,
    levelId,
    levelName: LEVEL_NAMES[levelId],
    savedAt: Date.now(),
    health: 100,
    plasma: 100,
    brass: 40,
    gears: 0,
    wrenchUnlocked: false,
    bringElias: false,
    tutorialPhase: 'explore',
    raceCheckpoint: 0,
    raceFinished: false,
    boardCamMode: 'first',
    boardOwned: false,
    economy: {
      brass: 40,
      aether: 0,
      items: {},
      parcelLeased: false,
      harvestRuns: 0,
      laborerHired: false,
      framesSold: 0,
      repairsDone: 0,
      bayLevel: 0,
      workers: [],
      playerBoard: { owned: false, thruster: false, rails: false, deck: false },
      customRecipes: [],
      customStock: {},
    },
    backstorySeed: (Math.random() * 0xffffffff) >>> 0,
  };
}

export function readSlot(index: number): ForgeSaveData | null {
  if (index < 0 || index >= SLOT_COUNT) return null;
  try {
    const raw = localStorage.getItem(slotKey(index));
    if (!raw) return null;
    const data = JSON.parse(raw) as ForgeSaveData;
    if (!data || data.version !== 1 || !data.levelId) return null;
    if (data.levelId === 'sky_race') {
      data.levelId = 'sky_city';
      data.tutorialPhase = 'city';
    }
    data.levelName = LEVEL_NAMES[data.levelId] || data.levelName || data.levelId;
    if (data.boardCamMode !== 'first' && data.boardCamMode !== 'third') {
      data.boardCamMode = 'first';
    }
    if (!data.economy) {
      data.economy = {
        brass: typeof data.brass === 'number' ? data.brass : 40,
        aether: 0,
        items: {},
        parcelLeased: false,
        harvestRuns: 0,
        laborerHired: false,
        framesSold: 0,
        repairsDone: 0,
        bayLevel: 0,
        workers: [],
        playerBoard: { owned: false, thruster: false, rails: false, deck: false },
        customRecipes: [],
        customStock: {},
      };
    }
    // Bidirectional: one purchase is forever across training + mega city
    if (!data.economy.playerBoard) {
      data.economy.playerBoard = { owned: false, thruster: false, rails: false, deck: false };
    }
    if (data.economy.playerBoard.owned || data.boardOwned) {
      data.boardOwned = true;
      data.economy.playerBoard.owned = true;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeSlot(index: number, data: ForgeSaveData): void {
  if (index < 0 || index >= SLOT_COUNT) return;
  data.savedAt = Date.now();
  if (data.levelId === 'sky_race') data.levelId = 'sky_city';
  data.levelName = LEVEL_NAMES[data.levelId] ?? data.levelName;
  localStorage.setItem(slotKey(index), JSON.stringify(data));
  localStorage.setItem(LAST_SLOT_KEY, String(index));
}

export function clearSlot(index: number): void {
  localStorage.removeItem(slotKey(index));
}

export function getLastSlotIndex(): number | null {
  const raw = localStorage.getItem(LAST_SLOT_KEY);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n >= SLOT_COUNT) return null;
  if (!readSlot(n)) return null;
  return n;
}

export function listSlots(): SlotInfo[] {
  const out: SlotInfo[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const data = readSlot(i);
    if (!data) {
      out.push({
        index: i,
        empty: true,
        data: null,
        label: 'Empty',
        sublabel: `Slot ${i + 1}`,
      });
    } else {
      const when = new Date(data.savedAt);
      const time = when.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      out.push({
        index: i,
        empty: false,
        data,
        label: data.levelName,
        sublabel: `Slot ${i + 1} · ${time}`,
      });
    }
  }
  return out;
}

export function formatLevelProgress(data: ForgeSaveData): string {
  const eco = data.economy as
    | {
        brass?: number;
        bayLevel?: number;
        parcelLeased?: boolean;
        workers?: unknown[];
        apartmentOwned?: boolean;
        cityWorkshopLeased?: boolean;
      }
    | undefined;
  const brass = eco?.brass ?? data.brass ?? 0;
  const lvl = eco?.bayLevel ?? (eco?.parcelLeased ? 1 : 0);
  const workers = Array.isArray(eco?.workers) ? eco!.workers!.length : 0;
  const bay = lvl > 0 ? ` · Bay L${lvl}` : '';
  const w = workers > 0 ? ` · ${workers} workers` : '';

  if (data.levelId === 'mega_city') {
    const shop = eco?.cityWorkshopLeased ? ' · Workshop' : '';
    return `Sky City · ${brass} brass${bay}${w}${shop}`;
  }
  if (
    data.levelId === 'sky_city' ||
    data.levelId === 'sky_race' ||
    data.tutorialPhase === 'city' ||
    data.tutorialPhase === 'race' ||
    data.tutorialPhase === 'won'
  ) {
    const apt = eco?.apartmentOwned ? ' · Apartment' : ` · Goal ${brass}/1000`;
    return `Market training · ${brass} brass${bay}${w}${apt}`;
  }
  const phase = data.tutorialPhase;
  if (phase === 'escape' || phase === 'breach') return 'Escape in progress';
  if (phase === 'siege') return 'Under siege';
  if (phase === 'rebuild') return 'Rebuilding Elias';
  return 'In the workshop';
}
