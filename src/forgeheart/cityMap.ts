/**
 * Empire city map — projects live world XZ into an SVG overlay.
 * Snapshot is built from buildSkyCity output so world edits update the map.
 */

import type { CityDistrictDef } from './economy';
import {
  CITY_DISTRICTS,
  districtById,
  harvestBiomeForDistrict,
  harvestSiteLabel,
  describeWorkerAssignment,
  type InventoryState,
  type WorkerState,
} from './economy';
import type { CityInteract, SkyCityBuilt, SkyRoute } from './skyCity';

export type MapLandmarkKind =
  | 'home'
  | 'workshop'
  | 'harvest'
  | 'stall'
  | 'broker'
  | 'ferry'
  | 'board_shop'
  | 'vendor'
  | 'rogue'
  | 'district'
  | 'expand'
  | 'storage';

export interface MapPad {
  id: string;
  name: string;
  x: number;
  z: number;
  size: number;
  role: CityDistrictDef['role'];
  color: number;
}

export interface MapLink {
  fromId: string;
  toId: string;
  /** Optional polyline samples in world XZ (from sky routes) */
  points: { x: number; z: number }[];
}

export interface MapLandmark {
  id: string;
  kind: MapLandmarkKind;
  label: string;
  x: number;
  z: number;
  districtId?: string;
  /** Short tag drawn on map (REEF, STALL, …) */
  tag?: string;
  /** Extra blurb for detail panel (mats, lease cost, vendor count) */
  blurb?: string;
}

export interface MapSnapshot {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pads: MapPad[];
  links: MapLink[];
  landmarks: MapLandmark[];
}

export interface MapLiveMarker {
  id: string;
  kind: 'player' | 'worker' | 'attention' | 'stall_status';
  label: string;
  x: number;
  z: number;
  yaw?: number;
  detail?: string;
  attention?: boolean;
  /** Owned stall open/closed ring */
  stallOpen?: boolean;
  stallOwned?: boolean;
}

/** Places list row for sidebar (Phase B) */
export interface MapPlaceRow {
  id: string;
  kind: string;
  label: string;
  dist: number;
  blurb?: string;
}

export type MapPlaceFilter =
  | 'all'
  | 'district'
  | 'harvest'
  | 'stall'
  | 'service'
  | 'crew';

/** Interactive map viewport (Phase C — pan / zoom / follow) */
export interface MapCamera {
  /** 1 = fit empire; higher = closer */
  zoom: number;
  /** World XZ shown at map center */
  cx: number;
  cz: number;
  /** Soft-track player each refresh */
  follow: boolean;
}

const ROLE_FILL: Record<CityDistrictDef['role'], string> = {
  home: '#5a5348',
  market: '#6a5a48',
  industrial: '#4a4840',
  harbor: '#4a5560',
  premium: '#5a4a68',
  mixed: '#555048',
};

const KIND_COLOR: Record<MapLandmarkKind, string> = {
  home: '#e8c878',
  workshop: '#7ec8e8',
  harvest: '#6dce8a',
  stall: '#ff9a66',
  broker: '#c49bff',
  ferry: '#88d0ff',
  board_shop: '#66e0ff',
  vendor: '#d4b06a',
  rogue: '#ff6644',
  district: '#c4a35a',
  expand: '#88aaff',
  storage: '#f0d080',
};

/** District skyway graph — keep in sync with skyCity skywayPairs. */
export const EMPIRE_SKYWAY_PAIRS: [string, string][] = [
  ['residential', 'mid_ring_east'],
  ['residential', 'mid_ring_west'],
  ['residential', 'harbor'],
  ['mid_ring_east', 'grand_market'],
  ['mid_ring_west', 'industrial'],
  ['mid_ring_east', 'clocktower'],
  ['mid_ring_west', 'gearworks'],
  ['harbor', 'spore_gardens'],
  ['harbor', 'brass_arcade'],
  ['grand_market', 'clocktower'],
  ['grand_market', 'aether_spire'],
  ['grand_market', 'south_docks'],
  ['industrial', 'sky_foundry'],
  ['industrial', 'gearworks'],
  ['gearworks', 'brass_arcade'],
  ['spore_gardens', 'north_observatory'],
  ['brass_arcade', 'north_observatory'],
  ['spore_gardens', 'clocktower'],
  ['sky_foundry', 'south_docks'],
  ['aether_spire', 'south_docks'],
];

/**
 * Build map geometry from the live city (pads, links, POIs).
 * Call once after buildSkyCity().
 */
export function buildMapSnapshot(city: SkyCityBuilt): MapSnapshot {
  const pads: MapPad[] = CITY_DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    x: d.x,
    z: d.z,
    size: d.size,
    role: d.role,
    color: d.color,
  }));

  // Links from sky routes when they span district centers; fallback to pair list
  const links: MapLink[] = [];
  const used = new Set<string>();
  for (const [a, b] of EMPIRE_SKYWAY_PAIRS) {
    const key = [a, b].sort().join('|');
    if (used.has(key)) continue;
    used.add(key);
    const da = districtById(a);
    const db = districtById(b);
    if (!da || !db) continue;
    const route = bestRouteBetween(city.skyRoutes, da.x, da.z, db.x, db.z);
    links.push({
      fromId: a,
      toId: b,
      points: route ?? [
        { x: da.x, z: da.z },
        { x: db.x, z: db.z },
      ],
    });
  }

  const landmarks: MapLandmark[] = [];

  // Home + workshop anchors
  landmarks.push({
    id: 'home',
    kind: 'home',
    label: 'Your apartment',
    x: city.apartmentSpawn.x,
    z: city.apartmentSpawn.z,
    districtId: 'residential',
  });
  landmarks.push({
    id: 'workshop',
    kind: 'workshop',
    label: 'City workshop',
    x: city.industrial.x,
    z: city.industrial.z,
    districtId: 'industrial',
  });

  // From interactables — world-true POIs (harvest, stalls, brokers, ferry, board, rogues)
  for (const it of city.interactables) {
    const lm = landmarkFromInteract(it);
    if (lm) landmarks.push(lm);
  }

  // Vendor hubs — one pin per district that has vendors (not every NPC)
  const vendorByDistrict = new Map<string, { n: number; x: number; z: number; names: string[] }>();
  for (const it of city.interactables) {
    if (it.kind !== 'vendor' || !it.districtId) continue;
    const cur = vendorByDistrict.get(it.districtId) ?? {
      n: 0,
      x: 0,
      z: 0,
      names: [] as string[],
    };
    cur.n += 1;
    cur.x += it.position.x;
    cur.z += it.position.z;
    if (it.vendor?.name) cur.names.push(it.vendor.name);
    vendorByDistrict.set(it.districtId, cur);
  }
  for (const [did, v] of vendorByDistrict) {
    const dist = districtById(did);
    landmarks.push({
      id: `vendors_${did}`,
      kind: 'vendor',
      label: `${dist?.name ?? did} market`,
      x: v.x / v.n,
      z: v.z / v.n,
      districtId: did,
      tag: 'MKT',
      blurb: `${v.n} vendors · ${v.names.slice(0, 3).join(', ')}${v.names.length > 3 ? '…' : ''}`,
    });
  }

  // Bounds from pads + landmarks + link samples
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const absorb = (x: number, z: number, r = 0) => {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minZ = Math.min(minZ, z - r);
    maxZ = Math.max(maxZ, z + r);
  };
  for (const p of pads) absorb(p.x, p.z, p.size * 0.55);
  for (const l of landmarks) absorb(l.x, l.z, 12);
  for (const link of links) {
    for (const pt of link.points) absorb(pt.x, pt.z, 8);
  }
  const pad = 48;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;

  return {
    bounds: { minX, maxX, minZ, maxZ },
    pads,
    links,
    landmarks,
  };
}

function landmarkFromInteract(it: CityInteract): MapLandmark | null {
  const x = it.position.x;
  const z = it.position.z;
  switch (it.kind) {
    case 'harvest': {
      const mats = it.harvestPool?.join(', ') ?? '';
      return {
        id: it.id,
        kind: 'harvest',
        label: it.harvestName ?? it.label,
        x,
        z,
        districtId: it.districtId,
        tag: 'REEF',
        blurb: mats ? `Yields ${mats}` : it.label,
      };
    }
    case 'city_stall': {
      const dist = it.districtId ? districtById(it.districtId) : undefined;
      return {
        id: it.id,
        kind: 'stall',
        label: dist ? `Stall · ${dist.name}` : 'Retail stall',
        x,
        z,
        districtId: it.districtId,
        tag: 'STALL',
        blurb: dist
          ? `Lease ${dist.stallCost}b · invent ×${dist.inventBonus}`
          : it.label,
      };
    }
    case 'broker':
      return {
        id: it.id,
        kind: 'broker',
        label: 'Frame broker',
        x,
        z,
        districtId: it.districtId,
        tag: 'BRK',
        blurb: 'Sell Basic Robot Frames for brass',
      };
    case 'ferry_training':
      return {
        id: it.id,
        kind: 'ferry',
        label: 'Ferry · training market',
        x,
        z,
        districtId: 'residential',
        tag: 'FERRY',
        blurb: 'Return to market training hub',
      };
    case 'board_shop':
      return {
        id: it.id,
        kind: 'board_shop',
        label: 'Board shop',
        x,
        z,
        districtId: 'residential',
        tag: 'BOARD',
        blurb: 'Buy / upgrade surfboard chassis',
      };
    case 'workshop_lease':
      return {
        id: 'workshop_lease_pin',
        kind: 'workshop',
        label: 'Workshop lease office',
        x,
        z,
        districtId: 'industrial',
        tag: 'LEASE',
        blurb: 'Lease empire HQ · craft · hire · invent',
      };
    case 'bay_expand':
      return {
        id: it.id,
        kind: 'expand',
        label: 'Expand yards · Sky Foundry',
        x,
        z,
        districtId: it.districtId ?? 'sky_foundry',
        tag: 'EXPAND',
        blurb: 'Raise bay level · more crew slots · unlimited empire expands',
      };
    case 'storage_office': {
      const track = it.storageTrack ?? 'resources';
      const label =
        track === 'resources'
          ? 'Bonded Resources · Observatory'
          : track === 'crafted'
            ? 'Craft Vault · Clocktower'
            : 'Invention Vault · Aether Spire';
      const tag = track === 'resources' ? 'STORE' : track === 'crafted' ? 'CRAFT' : 'INVENT';
      const blurb =
        track === 'resources'
          ? 'Raise raw mat stack caps'
          : track === 'crafted'
            ? 'Raise kits · frames · tools caps'
            : 'Raise invention stock caps';
      return {
        id: it.id,
        kind: 'storage',
        label,
        x,
        z,
        districtId: it.districtId,
        tag,
        blurb,
      };
    }
    case 'workshop_chest':
    case 'craft_bench':
    case 'hire_board':
    case 'invent_desk':
    case 'repair_job':
      // Covered by workshop hub pin
      return null;
    case 'city_robot':
      // Map pin only while rogue/downed (marker mesh is shown then)
      if (!it.mesh.visible) return null;
      return {
        id: it.id,
        kind: 'rogue',
        label: 'Rogue work robot',
        x,
        z,
        tag: '!',
        blurb: it.label,
      };
    case 'vendor':
      return null; // aggregated per district
    case 'neighbor':
      return null;
    default:
      return null;
  }
}

function bestRouteBetween(
  routes: SkyRoute[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { x: number; z: number }[] | null {
  let best: SkyRoute | null = null;
  let bestScore = Infinity;
  for (const r of routes) {
    if (r.path.length < 2) continue;
    const p0 = r.path[0]!;
    const p1 = r.path[r.path.length - 1]!;
    const s1 = Math.hypot(p0.x - ax, p0.z - az) + Math.hypot(p1.x - bx, p1.z - bz);
    const s2 = Math.hypot(p0.x - bx, p0.z - bz) + Math.hypot(p1.x - ax, p1.z - az);
    const s = Math.min(s1, s2);
    if (s < bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best || bestScore > 80) return null;
  return best.path.map((p) => ({ x: p.x, z: p.z }));
}

// ——— Projection ———

export interface MapView {
  /** SVG viewBox width/height */
  w: number;
  h: number;
  /** Padding inside viewBox (chrome only; camera uses full view) */
  pad: number;
}

const DEFAULT_VIEW: MapView = { w: 640, h: 520, pad: 28 };

export const MAP_ZOOM_MIN = 0.75;
export const MAP_ZOOM_MAX = 6;

export function defaultMapCamera(snap: MapSnapshot): MapCamera {
  return {
    zoom: 1,
    cx: (snap.bounds.minX + snap.bounds.maxX) * 0.5,
    cz: (snap.bounds.minZ + snap.bounds.maxZ) * 0.5,
    follow: false,
  };
}

/** World units → SVG pixels at current zoom (isotropic). */
export function mapWorldScale(
  snap: MapSnapshot,
  view: MapView = DEFAULT_VIEW,
  cam?: MapCamera | null,
): number {
  const { minX, maxX, minZ, maxZ } = snap.bounds;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxZ - minZ);
  const innerW = view.w - view.pad * 2;
  const innerH = view.h - view.pad * 2;
  const fit = Math.min(innerW / bw, innerH / bh);
  return fit * (cam?.zoom ?? 1);
}

export function clampMapCamera(snap: MapSnapshot, cam: MapCamera): MapCamera {
  const zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, cam.zoom));
  const { minX, maxX, minZ, maxZ } = snap.bounds;
  const mx = (maxX - minX) * 0.08;
  const mz = (maxZ - minZ) * 0.08;
  return {
    zoom,
    cx: Math.min(maxX + mx, Math.max(minX - mx, cam.cx)),
    cz: Math.min(maxZ + mz, Math.max(minZ - mz, cam.cz)),
    follow: cam.follow,
  };
}

export function worldToMap(
  snap: MapSnapshot,
  x: number,
  z: number,
  view: MapView = DEFAULT_VIEW,
  cam?: MapCamera | null,
): { u: number; v: number } {
  const scale = mapWorldScale(snap, view, cam);
  const cx = cam?.cx ?? (snap.bounds.minX + snap.bounds.maxX) * 0.5;
  const cz = cam?.cz ?? (snap.bounds.minZ + snap.bounds.maxZ) * 0.5;
  // Map +Z down on screen (north = −Z = up)
  return {
    u: view.w * 0.5 + (x - cx) * scale,
    v: view.h * 0.5 + (z - cz) * scale,
  };
}

export function mapToWorld(
  snap: MapSnapshot,
  u: number,
  v: number,
  view: MapView = DEFAULT_VIEW,
  cam?: MapCamera | null,
): { x: number; z: number } {
  const scale = Math.max(1e-6, mapWorldScale(snap, view, cam));
  const cx = cam?.cx ?? (snap.bounds.minX + snap.bounds.maxX) * 0.5;
  const cz = cam?.cz ?? (snap.bounds.minZ + snap.bounds.maxZ) * 0.5;
  return {
    x: cx + (u - view.w * 0.5) / scale,
    z: cz + (v - view.h * 0.5) / scale,
  };
}

/** Zoom toward a world point (or keep center if omitted). */
export function zoomMapCamera(
  snap: MapSnapshot,
  cam: MapCamera,
  factor: number,
  pivotWorld?: { x: number; z: number } | null,
): MapCamera {
  const nextZoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, cam.zoom * factor));
  if (!pivotWorld || Math.abs(nextZoom - cam.zoom) < 1e-6) {
    return clampMapCamera(snap, { ...cam, zoom: nextZoom });
  }
  // Keep pivot fixed on screen: center moves toward pivot when zooming in
  const t = 1 - cam.zoom / nextZoom;
  return clampMapCamera(snap, {
    ...cam,
    zoom: nextZoom,
    cx: cam.cx + (pivotWorld.x - cam.cx) * t,
    cz: cam.cz + (pivotWorld.z - cam.cz) * t,
  });
}

export function panMapCamera(
  snap: MapSnapshot,
  cam: MapCamera,
  dWorldX: number,
  dWorldZ: number,
): MapCamera {
  return clampMapCamera(snap, {
    ...cam,
    follow: false,
    cx: cam.cx + dWorldX,
    cz: cam.cz + dWorldZ,
  });
}

export function focusMapOn(
  snap: MapSnapshot,
  cam: MapCamera,
  x: number,
  z: number,
  zoom?: number,
): MapCamera {
  return clampMapCamera(snap, {
    ...cam,
    follow: false,
    cx: x,
    cz: z,
    zoom: zoom ?? Math.max(cam.zoom, 1.8),
  });
}

/** World position for a selected map id (pad / landmark / live). */
export function resolveMapTarget(
  snap: MapSnapshot,
  live: MapLiveMarker[],
  id: string | null,
): { x: number; z: number; label: string } | null {
  if (!id) return null;
  if (id === 'player') {
    const p = live.find((m) => m.kind === 'player');
    if (!p) return null;
    return { x: p.x, z: p.z, label: 'You' };
  }
  const pad = snap.pads.find((p) => p.id === id);
  if (pad) return { x: pad.x, z: pad.z, label: pad.name };
  const lm = snap.landmarks.find((l) => l.id === id);
  if (lm) return { x: lm.x, z: lm.z, label: lm.label };
  const liv = live.find((m) => m.id === id);
  if (liv) return { x: liv.x, z: liv.z, label: liv.label };
  return null;
}

/**
 * Route hint: district skyway hops when useful, else straight bearing line.
 * Returns world XZ samples for the dashed guide.
 */
export function routeToTarget(
  snap: MapSnapshot,
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number }[] {
  const straight = [from, to];
  const nearPad = (x: number, z: number) => {
    let best: MapPad | null = null;
    let bestD = Infinity;
    for (const p of snap.pads) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    // Only route via skyways if reasonably near a plaza
    if (!best || bestD > Math.max(80, best.size * 0.9)) return null;
    return best;
  };
  const a = nearPad(from.x, from.z);
  const b = nearPad(to.x, to.z);
  if (!a || !b || a.id === b.id) return straight;

  // BFS on skyway graph
  const adj = new Map<string, string[]>();
  for (const [u, v] of EMPIRE_SKYWAY_PAIRS) {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u)!.push(v);
    adj.get(v)!.push(u);
  }
  const q = [a.id];
  const prev = new Map<string, string | null>([[a.id, null]]);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === b.id) break;
    for (const n of adj.get(cur) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      q.push(n);
    }
  }
  if (!prev.has(b.id)) return straight;

  const chain: string[] = [];
  let walk: string | null = b.id;
  while (walk) {
    chain.push(walk);
    walk = prev.get(walk) ?? null;
  }
  chain.reverse();
  if (chain.length < 2) return straight;

  const pts: { x: number; z: number }[] = [{ x: from.x, z: from.z }];
  for (let i = 0; i < chain.length - 1; i++) {
    const fromId = chain[i]!;
    const toId = chain[i + 1]!;
    const link = snap.links.find(
      (l) =>
        (l.fromId === fromId && l.toId === toId) ||
        (l.fromId === toId && l.toId === fromId),
    );
    if (link && link.points.length >= 2) {
      // Orient path toward next hop
      const p0 = link.points[0]!;
      const p1 = link.points[link.points.length - 1]!;
      const da = districtById(fromId);
      const forward =
        da &&
        Math.hypot(p0.x - da.x, p0.z - da.z) <= Math.hypot(p1.x - da.x, p1.z - da.z);
      const samples = forward ? link.points : [...link.points].reverse();
      for (const s of samples) pts.push({ x: s.x, z: s.z });
    } else {
      const d = districtById(toId);
      if (d) pts.push({ x: d.x, z: d.z });
    }
  }
  pts.push({ x: to.x, z: to.z });
  return pts;
}

// ——— Live markers ———

export function buildLiveMarkers(
  snap: MapSnapshot,
  inv: InventoryState,
  player: { x: number; z: number; yaw: number },
  opts?: { workshopLeased?: boolean },
): MapLiveMarker[] {
  const out: MapLiveMarker[] = [];

  out.push({
    id: 'player',
    kind: 'player',
    label: 'You',
    x: player.x,
    z: player.z,
    yaw: player.yaw,
  });

  for (const w of inv.workers) {
    const pos = workerMapPosition(snap, inv, w);
    out.push({
      id: `worker_${w.id}`,
      kind: 'worker',
      label: w.hasMedallion ? `★ ${w.name}` : w.kind === 'robot' ? `⚙ ${w.name}` : w.name,
      x: pos.x,
      z: pos.z,
      detail: describeWorkerAssignment(inv, w),
      attention: w.job === 'idle' || !!w.hasMedallion,
    });
  }

  // Theme-park circuits
  for (const d of CITY_DISTRICTS) {
    if (!d.themePark) continue;
    out.push({
      id: `circuit_${d.id}`,
      kind: 'attention',
      label: `Circuit · ${d.name}`,
      x: d.x + d.size * 0.35,
      z: d.z,
      detail: 'Board theme-park track',
      attention: false,
    });
  }

  // Attention: open empty stalls, haggles, unleased workshop
  for (const [did, stall] of Object.entries(inv.cityStalls ?? {})) {
    if (!stall.owned) continue;
    const dist = districtById(did);
    if (!dist) continue;
    const empty =
      Object.keys(stall.shelf ?? {}).length === 0 &&
      Object.keys(stall.customShelf ?? {}).length === 0;
    if (stall.open && empty) {
      out.push({
        id: `attn_stall_${did}`,
        kind: 'attention',
        label: `${dist.name} stall empty`,
        x: dist.x + dist.size * 0.28,
        z: dist.z + dist.size * 0.2,
        attention: true,
        detail: 'Stock shelf or close stall',
      });
    }
    if (stall.pendingHaggle) {
      out.push({
        id: `attn_haggle_${did}`,
        kind: 'attention',
        label: `${dist.name} haggle!`,
        x: dist.x + dist.size * 0.28,
        z: dist.z + dist.size * 0.2,
        attention: true,
        detail: 'Open stall to accept/refuse',
      });
    }
  }

  if (!opts?.workshopLeased && !inv.cityWorkshopLeased) {
    const ind = districtById('industrial');
    if (ind) {
      out.push({
        id: 'attn_workshop',
        kind: 'attention',
        label: 'Lease workshop',
        x: ind.x,
        z: ind.z,
        attention: true,
        detail: 'Industrial HQ unlocks empire craft/hire',
      });
    }
  }

  // Owned stall status rings (open/closed) on top of stall landmarks
  for (const [did, stall] of Object.entries(inv.cityStalls ?? {})) {
    if (!stall.owned) continue;
    const lm = snap.landmarks.find((l) => l.kind === 'stall' && l.districtId === did);
    const dist = districtById(did);
    if (!lm && !dist) continue;
    const x = lm?.x ?? dist!.x + dist!.size * 0.28;
    const z = lm?.z ?? dist!.z + dist!.size * 0.2;
    const shelfN = Object.values(stall.shelf ?? {}).reduce((a, n) => a + (n ?? 0), 0);
    const inventN = Object.values(stall.customShelf ?? {}).reduce((a, n) => a + (n ?? 0), 0);
    out.push({
      id: `stall_live_${did}`,
      kind: 'stall_status',
      label: dist?.name ?? did,
      x,
      z,
      stallOwned: true,
      stallOpen: stall.open,
      detail: `${stall.open ? 'OPEN' : 'CLOSED'} · shelf ${shelfN} · invent ${inventN} · sales ${stall.sales}`,
      attention: stall.open && shelfN + inventN === 0,
    });
  }

  return out;
}

function workerMapPosition(
  snap: MapSnapshot,
  inv: InventoryState,
  w: WorkerState,
): { x: number; z: number } {
  const workshop = snap.landmarks.find((l) => l.kind === 'workshop');
  const home = snap.landmarks.find((l) => l.kind === 'home');
  const market = snap.pads.find((p) => p.id === 'grand_market');

  if (w.job === 'harvest' || (w.job === 'program' && programHasHarvest(inv, w))) {
    if (w.harvestSiteId) {
      const reef = snap.landmarks.find(
        (l) => l.kind === 'harvest' && l.districtId === w.harvestSiteId,
      );
      if (reef) return { x: reef.x, z: reef.z };
      const pad = snap.pads.find((p) => p.id === w.harvestSiteId);
      if (pad) return { x: pad.x, z: pad.z };
      const biome = harvestBiomeForDistrict(w.harvestSiteId);
      void biome;
    }
    // Mixed — near workshop / residential
    if (workshop) return { x: workshop.x + 20, z: workshop.z + 15 };
  }

  if (w.job === 'sell_frame') {
    const broker = snap.landmarks.find((l) => l.kind === 'broker');
    if (broker) return { x: broker.x, z: broker.z };
    if (market) return { x: market.x, z: market.z };
  }

  if (w.job === 'repair') {
    const rogue = snap.landmarks.find((l) => l.kind === 'rogue');
    if (rogue) return { x: rogue.x, z: rogue.z };
  }

  // Craft / program non-harvest / idle → workshop
  if (workshop) return { x: workshop.x, z: workshop.z };
  if (home) return { x: home.x, z: home.z };
  return { x: 0, z: 0 };
}

function programHasHarvest(inv: InventoryState, w: WorkerState): boolean {
  if (!w.programId) return false;
  const p = inv.programs.find((x) => x.id === w.programId);
  return !!p?.nodes.includes('harvest');
}

// ——— Filter visibility (Phase C polish) ———

function isServiceLandmark(kind: MapLandmarkKind): boolean {
  return (
    kind === 'broker' ||
    kind === 'ferry' ||
    kind === 'board_shop' ||
    kind === 'workshop' ||
    kind === 'home' ||
    kind === 'vendor' ||
    kind === 'expand' ||
    kind === 'storage'
  );
}

/** Whether a static landmark pin/label is shown for the active filter. */
export function landmarkMatchesFilter(
  kind: MapLandmarkKind,
  filter: MapPlaceFilter = 'all',
): boolean {
  if (filter === 'all') return true;
  if (filter === 'district' || filter === 'crew') return false;
  if (filter === 'harvest') return kind === 'harvest';
  if (filter === 'stall') return kind === 'stall';
  if (filter === 'service') return isServiceLandmark(kind);
  return true;
}

/** Whether a live marker is shown for the active filter. Player always shown. */
export function liveMatchesFilter(
  kind: MapLiveMarker['kind'],
  filter: MapPlaceFilter = 'all',
): boolean {
  if (kind === 'player') return true;
  if (filter === 'all') return true;
  if (filter === 'crew') return kind === 'worker';
  if (filter === 'stall') return kind === 'stall_status';
  // District / harvest / service: hide crew & stall rings & loose attention clutter
  if (filter === 'district' || filter === 'harvest' || filter === 'service') {
    return false;
  }
  return true;
}

/** Pad name labels only when All or Plazas. */
export function padLabelsVisible(filter: MapPlaceFilter = 'all'): boolean {
  return filter === 'all' || filter === 'district';
}

/**
 * Map arrow rotation (SVG degrees, clockwise).
 * World yaw: 0 = +Z, π/2 = +X. Map: +X right, +Z down.
 * Chevron points up (map −Z); convert facing → screen.
 */
export function playerArrowDeg(yaw: number): number {
  return 180 - (yaw * 180) / Math.PI;
}

// ——— Render ———

export function renderCityMap(
  svg: SVGSVGElement,
  snap: MapSnapshot,
  live: MapLiveMarker[],
  selectedId: string | null,
  view: MapView = DEFAULT_VIEW,
  cam?: MapCamera | null,
  filter: MapPlaceFilter = 'all',
): void {
  const ns = 'http://www.w3.org/2000/svg';
  const camera = cam ?? defaultMapCamera(snap);
  const scale = mapWorldScale(snap, view, camera);
  const showPadNames = padLabelsVisible(filter);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${view.w} ${view.h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  // Background
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(view.w));
  bg.setAttribute('height', String(view.h));
  bg.setAttribute('fill', '#0a121c');
  svg.appendChild(bg);

  // Soft grid (screen-space)
  const gGrid = document.createElementNS(ns, 'g');
  gGrid.setAttribute('opacity', '0.12');
  const step = 40;
  for (let x = 0; x <= view.w; x += step) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', '0');
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(view.h));
    line.setAttribute('stroke', '#c4a35a');
    line.setAttribute('stroke-width', '0.5');
    gGrid.appendChild(line);
  }
  for (let y = 0; y <= view.h; y += step) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(view.w));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#c4a35a');
    line.setAttribute('stroke-width', '0.5');
    gGrid.appendChild(line);
  }
  svg.appendChild(gGrid);

  // Skyways — soft glow under bright core (wind lanes)
  const gLinks = document.createElementNS(ns, 'g');
  if (filter !== 'all') gLinks.setAttribute('opacity', '0.4');
  for (const link of snap.links) {
    if (link.points.length < 2) continue;
    const d = link.points
      .map((p, i) => {
        const { u, v } = worldToMap(snap, p.x, p.z, view, camera);
        return `${i === 0 ? 'M' : 'L'}${u.toFixed(1)},${v.toFixed(1)}`;
      })
      .join(' ');
    const glow = document.createElementNS(ns, 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', '#2288aa');
    glow.setAttribute('stroke-width', '5');
    glow.setAttribute('stroke-opacity', '0.28');
    glow.setAttribute('stroke-linecap', 'round');
    gLinks.appendChild(glow);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#66e0ff');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-opacity', '0.75');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-dasharray', '5 4');
    gLinks.appendChild(path);
  }
  svg.appendChild(gLinks);

  // Route guide: you → selection (skyway-aware when possible)
  const you = live.find((m) => m.kind === 'player');
  const target = resolveMapTarget(snap, live, selectedId);
  if (you && target && selectedId && selectedId !== 'player') {
    const route = routeToTarget(snap, you, target);
    if (route.length >= 2) {
      const d = route
        .map((p, i) => {
          const { u, v } = worldToMap(snap, p.x, p.z, view, camera);
          return `${i === 0 ? 'M' : 'L'}${u.toFixed(1)},${v.toFixed(1)}`;
        })
        .join(' ');
      const gRoute = document.createElementNS(ns, 'g');
      const glow = document.createElementNS(ns, 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', '#e8c878');
      glow.setAttribute('stroke-width', '4');
      glow.setAttribute('stroke-opacity', '0.22');
      glow.setAttribute('stroke-linecap', 'round');
      gRoute.appendChild(glow);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#f0d080');
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-opacity', '0.9');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', '7 5');
      path.classList.add('map-route');
      gRoute.appendChild(path);
      svg.appendChild(gRoute);
    }
  }

  // Player range rings (100u / 250u) when selected is player or nothing
  if ((selectedId === 'player' || selectedId === null) && you) {
    const gRing = document.createElementNS(ns, 'g');
    gRing.setAttribute('opacity', '0.2');
    for (const ru of [100, 250]) {
      const a = worldToMap(snap, you.x, you.z, view, camera);
      const rr = ru * scale;
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(a.u));
      circle.setAttribute('cy', String(a.v));
      circle.setAttribute('r', String(rr));
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#c4a35a');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('stroke-dasharray', '3 4');
      gRing.appendChild(circle);
    }
    svg.appendChild(gRing);
  }

  // Pads (size scales with zoom so plazas stay legible)
  const gPads = document.createElementNS(ns, 'g');
  // When filtering non-plaza POIs, dim base plazas so selected pins pop
  if (!showPadNames) gPads.setAttribute('opacity', '0.35');
  for (const pad of snap.pads) {
    const { u, v } = worldToMap(snap, pad.x, pad.z, view, camera);
    const r = Math.max(8, pad.size * scale * 0.18);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(u - r));
    rect.setAttribute('y', String(v - r));
    rect.setAttribute('width', String(r * 2));
    rect.setAttribute('height', String(r * 2));
    rect.setAttribute('rx', String(r * 0.25));
    rect.setAttribute('fill', ROLE_FILL[pad.role] ?? '#555');
    rect.setAttribute('stroke', selectedId === pad.id ? '#f0e0b0' : 'rgba(196,163,90,0.55)');
    rect.setAttribute('stroke-width', selectedId === pad.id ? '2.5' : '1.2');
    rect.setAttribute('data-map-id', pad.id);
    rect.setAttribute('data-map-kind', 'district');
    rect.style.cursor = 'pointer';
    gPads.appendChild(rect);

    if (showPadNames) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(u));
      label.setAttribute('y', String(v + r + 11));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#d8d0c0');
      label.setAttribute('font-size', '9');
      label.setAttribute('font-family', 'system-ui,sans-serif');
      label.setAttribute('pointer-events', 'none');
      label.textContent = shortName(pad.name);
      gPads.appendChild(label);
    }
  }
  svg.appendChild(gPads);

  // Static landmarks (filtered — hide non-matching pins/labels)
  const gLm = document.createElementNS(ns, 'g');
  for (const lm of snap.landmarks) {
    if (!landmarkMatchesFilter(lm.kind, filter)) continue;
    const { u, v } = worldToMap(snap, lm.x, lm.z, view, camera);
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('data-map-id', lm.id);
    g.setAttribute('data-map-kind', lm.kind);
    g.style.cursor = 'pointer';

    const big = lm.kind === 'home' || lm.kind === 'workshop';
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', String(u));
    c.setAttribute('cy', String(v));
    c.setAttribute('r', big ? '6.5' : lm.kind === 'vendor' ? '5' : '4.5');
    c.setAttribute('fill', KIND_COLOR[lm.kind] ?? '#ccc');
    c.setAttribute('stroke', selectedId === lm.id ? '#fff' : 'rgba(0,0,0,0.55)');
    c.setAttribute('stroke-width', selectedId === lm.id ? '2.2' : '1');
    g.appendChild(c);

    const tag =
      lm.tag ??
      (lm.kind === 'home'
        ? 'HOME'
        : lm.kind === 'workshop'
          ? 'WORK'
          : lm.kind === 'harvest'
            ? 'REEF'
            : lm.kind === 'stall'
              ? 'STALL'
              : lm.kind === 'broker'
                ? 'BRK'
                : lm.kind === 'ferry'
                  ? 'FERRY'
                  : lm.kind === 'board_shop'
                    ? 'BOARD'
                    : lm.kind === 'vendor'
                      ? 'MKT'
                      : lm.kind === 'rogue'
                        ? '!'
                        : lm.kind === 'expand'
                          ? 'EXPAND'
                          : '');
    if (tag) {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(u));
      t.setAttribute('y', String(v - 9));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', KIND_COLOR[lm.kind]);
      t.setAttribute('font-size', '7.5');
      t.setAttribute('font-family', 'system-ui,sans-serif');
      t.setAttribute('font-weight', '600');
      t.setAttribute('pointer-events', 'none');
      t.textContent = tag;
      gLm.appendChild(t);
    }
    gLm.appendChild(g);
  }
  svg.appendChild(gLm);

  // Live markers (filtered — player always kept)
  const gLive = document.createElementNS(ns, 'g');
  for (const m of live) {
    if (!liveMatchesFilter(m.kind, filter)) continue;
    const { u, v } = worldToMap(snap, m.x, m.z, view, camera);
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('data-map-id', m.id);
    g.setAttribute('data-map-kind', m.kind);

    if (m.kind === 'player') {
      // World yaw 0 = +Z (map down); chevron local up = map −Z → 180° − yaw
      const deg = playerArrowDeg(m.yaw ?? 0);
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', '0,-8 6,6 0,3 -6,6');
      poly.setAttribute('fill', '#f0e8c8');
      poly.setAttribute('stroke', '#c4a35a');
      poly.setAttribute('stroke-width', '1');
      poly.setAttribute('transform', `translate(${u},${v}) rotate(${deg})`);
      g.appendChild(poly);
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(u));
      t.setAttribute('y', String(v + 16));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#f0e0b0');
      t.setAttribute('font-size', '9');
      t.setAttribute('font-weight', '700');
      t.setAttribute('pointer-events', 'none');
      t.textContent = 'YOU';
      g.appendChild(t);
    } else if (m.kind === 'worker') {
      const sel = selectedId === m.id;
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', String(u));
      c.setAttribute('cy', String(v));
      c.setAttribute('r', sel ? '5.5' : '4');
      c.setAttribute('fill', m.attention ? '#888' : '#a8d4ff');
      c.setAttribute('stroke', sel ? '#fff' : '#1a3040');
      c.setAttribute('stroke-width', sel ? '2' : '1');
      g.appendChild(c);
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(u + 7));
      t.setAttribute('y', String(v + 3));
      t.setAttribute('fill', '#b8d8f0');
      t.setAttribute('font-size', '8');
      t.setAttribute('pointer-events', 'none');
      t.textContent = m.label;
      g.appendChild(t);
    } else if (m.kind === 'stall_status') {
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('cx', String(u));
      ring.setAttribute('cy', String(v));
      ring.setAttribute('r', '7.5');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', m.stallOpen ? '#82e0aa' : '#888');
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('stroke-dasharray', m.stallOpen ? '0' : '3 2');
      g.appendChild(ring);
      if (m.attention) {
        const pulse = document.createElementNS(ns, 'circle');
        pulse.setAttribute('cx', String(u));
        pulse.setAttribute('cy', String(v));
        pulse.setAttribute('r', '11');
        pulse.setAttribute('fill', 'none');
        pulse.setAttribute('stroke', '#ff8866');
        pulse.setAttribute('stroke-width', '1.5');
        pulse.classList.add('map-pulse');
        g.appendChild(pulse);
      }
    } else if (m.kind === 'attention') {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', String(u));
      c.setAttribute('cy', String(v));
      c.setAttribute('r', '8');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', '#ff8866');
      c.setAttribute('stroke-width', '2');
      c.setAttribute('opacity', '0.9');
      c.classList.add('map-pulse');
      g.appendChild(c);
    }
    gLive.appendChild(g);
  }
  svg.appendChild(gLive);

  // Chrome: compass + zoom readout
  const n = document.createElementNS(ns, 'text');
  n.setAttribute('x', String(view.w - 36));
  n.setAttribute('y', String(view.h - 14));
  n.setAttribute('fill', '#c4a35a');
  n.setAttribute('font-size', '10');
  n.setAttribute('font-weight', '700');
  n.setAttribute('opacity', '0.65');
  n.textContent = '↓ +Z';
  svg.appendChild(n);
  const n2 = document.createElementNS(ns, 'text');
  n2.setAttribute('x', String(view.w - 36));
  n2.setAttribute('y', '16');
  n2.setAttribute('fill', '#c4a35a');
  n2.setAttribute('font-size', '10');
  n2.setAttribute('font-weight', '700');
  n2.setAttribute('opacity', '0.65');
  n2.textContent = '↑ −Z';
  svg.appendChild(n2);
  const zLabel = document.createElementNS(ns, 'text');
  zLabel.setAttribute('x', '10');
  zLabel.setAttribute('y', String(view.h - 12));
  zLabel.setAttribute('fill', '#8a9aab');
  zLabel.setAttribute('font-size', '10');
  zLabel.setAttribute('font-family', 'system-ui,sans-serif');
  zLabel.textContent = `×${camera.zoom.toFixed(1)}${camera.follow ? ' · follow' : ''}`;
  svg.appendChild(zLabel);
}

function shortName(name: string): string {
  if (name.length <= 14) return name;
  return name.replace(/^(The|Sky|Cloud)\s+/i, '').slice(0, 14);
}

export function describeSelection(
  snap: MapSnapshot,
  live: MapLiveMarker[],
  id: string | null,
  player: { x: number; z: number },
): string {
  if (!id) {
    return 'Scroll zoom · drag pan · click pin for route · M closes';
  }
  const fmt = (x: number, z: number, title: string, extra?: string) => {
    const d = Math.hypot(x - player.x, z - player.z);
    const bearing = bearingLabel(player.x, player.z, x, z, playerYawFromLive(live));
    return `${title}\n${Math.round(d)} u · ${bearing}${extra ? `\n${extra}` : ''}`;
  };

  if (id === 'player') {
    return fmt(player.x, player.z, 'You', 'Current position · Follow to track');
  }
  const pad = snap.pads.find((p) => p.id === id);
  if (pad) {
    const distDef = districtById(pad.id);
    const biome = harvestBiomeForDistrict(pad.id);
    const extras = [
      `Role: ${pad.role}`,
      biome?.mats?.length ? `Reef mats: ${biome.mats.join(', ')}` : '',
      distDef ? `Stall lease: ${distDef.stallCost}b · invent ×${distDef.inventBonus}` : '',
      'Gold line = suggested skyway route',
    ]
      .filter(Boolean)
      .join(' · ');
    return fmt(pad.x, pad.z, pad.name, extras);
  }
  const lm = snap.landmarks.find((l) => l.id === id);
  if (lm) {
    return fmt(lm.x, lm.z, lm.label, `${lm.blurb ?? lm.kind} · gold line = route`);
  }
  const liv = live.find((m) => m.id === id);
  if (liv) {
    return fmt(liv.x, liv.z, liv.label, liv.detail);
  }
  return id;
}

function playerYawFromLive(live: MapLiveMarker[]): number {
  return live.find((m) => m.kind === 'player')?.yaw ?? 0;
}

/** Compass-style bearing relative to facing (F / FL / L / …) */
function bearingLabel(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  faceYaw: number,
): string {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  if (Math.hypot(dx, dz) < 6) return 'here';
  let rel = Math.atan2(dx, dz) - faceYaw;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const deg = (rel * 180) / Math.PI;
  const sectors = [
    'ahead',
    'ahead-right',
    'right',
    'back-right',
    'behind',
    'back-left',
    'left',
    'ahead-left',
  ];
  const idx = Math.round(((deg + 360) % 360) / 45) % 8;
  return sectors[idx]!;
}

/** Sorted places list for sidebar (districts + key POIs + crew) */
export function listMapPlaces(
  snap: MapSnapshot,
  player: { x: number; z: number },
  filter: MapPlaceFilter = 'all',
  live: MapLiveMarker[] = [],
): MapPlaceRow[] {
  const rows: MapPlaceRow[] = [];

  if (filter === 'all' || filter === 'district') {
    for (const pad of snap.pads) {
      rows.push({
        id: pad.id,
        kind: 'district',
        label: pad.name,
        dist: Math.hypot(pad.x - player.x, pad.z - player.z),
        blurb: pad.role,
      });
    }
  }

  if (filter !== 'district' && filter !== 'crew') {
    for (const lm of snap.landmarks) {
      if (filter === 'harvest' && lm.kind !== 'harvest') continue;
      if (filter === 'stall' && lm.kind !== 'stall') continue;
      if (
        filter === 'service' &&
        !isServiceLandmark(lm.kind)
      ) {
        continue;
      }
      if (filter === 'all' || filter === 'harvest' || filter === 'stall' || filter === 'service') {
        if (lm.id === 'workshop_lease_pin') continue;
        rows.push({
          id: lm.id,
          kind: lm.kind,
          label: lm.label,
          dist: Math.hypot(lm.x - player.x, lm.z - player.z),
          blurb: lm.blurb ?? lm.tag,
        });
      }
    }
  }

  if (filter === 'all' || filter === 'crew') {
    for (const m of live) {
      if (m.kind !== 'worker') continue;
      rows.push({
        id: m.id,
        kind: 'crew',
        label: m.label,
        dist: Math.hypot(m.x - player.x, m.z - player.z),
        blurb: m.detail ?? (m.attention ? 'Idle' : 'On task'),
      });
    }
  }

  rows.sort((a, b) => a.dist - b.dist);
  return rows;
}

export function hitTestMap(
  snap: MapSnapshot,
  live: MapLiveMarker[],
  svgX: number,
  svgY: number,
  view: MapView = DEFAULT_VIEW,
  cam?: MapCamera | null,
  filter: MapPlaceFilter = 'all',
): string | null {
  const camera = cam ?? defaultMapCamera(snap);
  const scale = mapWorldScale(snap, view, camera);
  const near = (x: number, z: number, r: number): boolean => {
    const { u, v } = worldToMap(snap, x, z, view, camera);
    return Math.hypot(u - svgX, v - svgY) <= r;
  };

  if (
    near(
      live.find((m) => m.kind === 'player')?.x ?? 1e9,
      live.find((m) => m.kind === 'player')?.z ?? 1e9,
      14,
    )
  ) {
    return 'player';
  }
  for (const m of live) {
    if (m.kind === 'player') continue;
    if (!liveMatchesFilter(m.kind, filter)) continue;
    if (near(m.x, m.z, 12)) return m.id;
  }
  for (const lm of snap.landmarks) {
    if (!landmarkMatchesFilter(lm.kind, filter)) continue;
    if (near(lm.x, lm.z, 10)) return lm.id;
  }
  // Pads always hittable (geography); labels only drawn for All/Plazas
  for (const pad of snap.pads) {
    const { u, v } = worldToMap(snap, pad.x, pad.z, view, camera);
    const r = Math.max(8, pad.size * scale * 0.18);
    if (Math.abs(u - svgX) <= r && Math.abs(v - svgY) <= r) return pad.id;
  }
  return null;
}

/** Client → SVG viewBox coords for the map SVG element */
export function clientToMapSvg(
  el: SVGSVGElement,
  clientX: number,
  clientY: number,
): { u: number; v: number } | null {
  const pt = el.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = el.getScreenCTM();
  if (!ctm) return null;
  const loc = pt.matrixTransform(ctm.inverse());
  return { u: loc.x, v: loc.y };
}

export { harvestSiteLabel };
