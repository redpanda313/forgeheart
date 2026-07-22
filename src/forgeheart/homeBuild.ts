/**
 * Player home site builder — expand footprint, rooms with functions, décor, colors.
 * Mirrors stall/factory wizard flow; prices rise steeply with size.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import { buildEnterableShell } from './enterableBuilding';
import type { Collider } from './level';
import type { HomeLayout, HomeRoom, HomeRoomKind, HomeTier, SiteProp } from './economy';
import { CITY_DISTRICTS } from './economy';
import { addFrontDoorCue } from './stallBuild';

/** Match skyCity floorPad walkable top so expansions stay solid underfoot. */
const HOME_PAD_Y = 0.2;
const HOME_PAD_THICK = 0.55;
export const HOME_PAD_TOP = HOME_PAD_Y + HOME_PAD_THICK / 2 + 0.12;
/** Shell first-floor top is ~0.23 — lift content so floors meet the pad. */
export const HOME_CONTENT_Y = HOME_PAD_TOP - 0.23;

export const HOME_TIERS: {
  id: HomeTier;
  name: string;
  blurb: string;
  extraCost: number;
  /** Deck footprint */
  padW: number;
  padD: number;
  floors: number;
  roomCap: number;
}[] = [
  {
    id: 'cottage',
    name: 'Cottage',
    blurb: 'Starter flat · 1 room',
    extraCost: 0,
    padW: 14,
    padD: 12,
    floors: 1,
    roomCap: 1,
  },
  {
    id: 'house',
    name: 'House',
    blurb: 'Roomy home · 2 rooms',
    extraCost: 450,
    padW: 22,
    padD: 18,
    floors: 1,
    roomCap: 2,
  },
  {
    id: 'manor',
    name: 'Manor',
    blurb: 'Two floors · 3 rooms',
    extraCost: 1400,
    padW: 34,
    padD: 28,
    floors: 2,
    roomCap: 3,
  },
  {
    id: 'estate',
    name: 'Estate',
    blurb: 'Wide grounds · 4 rooms',
    extraCost: 3800,
    padW: 48,
    padD: 40,
    floors: 2,
    roomCap: 4,
  },
  {
    id: 'island',
    name: 'Private Island',
    blurb: 'Fill your home island · 5 rooms',
    extraCost: 9000,
    padW: 64,
    padD: 56,
    floors: 3,
    roomCap: 5,
  },
];

export const HOME_COLOR_NAMES = [
  'Warm cedar',
  'Brick rose',
  'Brass & ivory',
  'Harbor teal',
  'Garden green',
  'Midnight slate',
] as const;

export const HOME_COLORS = [
  { wood: 0x6a5848, accent: 0xc4a35a, cloth: 0x8a7060 },
  { wood: 0x5a4038, accent: 0xc45a3a, cloth: 0xa85848 },
  { wood: 0x5a5040, accent: 0xe0c060, cloth: 0xd8c8a0 },
  { wood: 0x4a5560, accent: 0x3ad0f0, cloth: 0x3a8aaa },
  { wood: 0x4a5a48, accent: 0x6acc66, cloth: 0x5a8a58 },
  { wood: 0x3a3a50, accent: 0x8877cc, cloth: 0x4a4068 },
] as const;

/** Functional rooms — place like props; capped by home tier */
export const HOME_ROOM_CATALOG: {
  id: HomeRoomKind;
  name: string;
  blurb: string;
  cost: number;
}[] = [
  { id: 'living', name: 'Living room', blurb: 'Hearth & seating', cost: 0 },
  { id: 'workshop', name: 'Workshop', blurb: 'Craft bench at home', cost: 380 },
  { id: 'invent_lab', name: 'Invention lab', blurb: 'Prototype desk at home', cost: 520 },
  { id: 'gallery', name: 'Gallery', blurb: 'Display frames & inventions', cost: 220 },
  { id: 'garden', name: 'Garden court', blurb: 'Open air blooms', cost: 180 },
];

export const HOME_PROP_CATALOG: {
  id: string;
  name: string;
  blurb: string;
  cost: number;
}[] = [
  { id: 'planters', name: 'Window boxes', blurb: 'Soft greenery', cost: 40 },
  { id: 'lanterns', name: 'Porch lanterns', blurb: 'Warm evening light', cost: 45 },
  { id: 'banners', name: 'House banners', blurb: 'Family colors', cost: 50 },
  { id: 'benches', name: 'Garden benches', blurb: 'Sit & watch the sky', cost: 55 },
  { id: 'fountain', name: 'Courtyard fountain', blurb: 'Centerpiece water', cost: 120 },
  { id: 'statue', name: 'Brass statue', blurb: 'Proud ornament', cost: 150 },
  { id: 'trellis', name: 'Climbing trellis', blurb: 'Vines on the wall', cost: 70 },
  { id: 'chimney', name: 'Extra chimney', blurb: 'Skyline silhouette', cost: 90 },
];

export const HOME_COLOR_BASE = 25;
export const HOME_COLOR_STEP = 20;

/** Fixed home-island anchor (matches skyCity residential offset). */
export function apartmentAnchorXZ(): { x: number; z: number } {
  const r = CITY_DISTRICTS.find((d) => d.id === 'residential')!;
  return { x: r.x - 32, z: r.z + 20 };
}

export function homeTierDef(tier: HomeTier) {
  return HOME_TIERS.find((t) => t.id === tier) ?? HOME_TIERS[0]!;
}

export function homeTierExtra(tier: HomeTier): number {
  return homeTierDef(tier).extraCost;
}

export function homeRoomCap(tier: HomeTier): number {
  return homeTierDef(tier).roomCap;
}

export function homeColorFee(color: number): number {
  const c = Math.max(0, Math.min(HOME_COLORS.length - 1, color));
  if (c === 0) return 0;
  return HOME_COLOR_BASE + c * HOME_COLOR_STEP;
}

export function homeRoomCost(kind: HomeRoomKind): number {
  return HOME_ROOM_CATALOG.find((r) => r.id === kind)?.cost ?? 100;
}

export function homePropCost(id: string): number {
  return HOME_PROP_CATALOG.find((p) => p.id === id)?.cost ?? 40;
}

export function sumHomeRoomsCost(rooms: HomeRoom[]): number {
  let n = 0;
  for (const r of rooms) n += homeRoomCost(r.kind);
  return n;
}

export function sumHomePropsCost(props: SiteProp[]): number {
  let n = 0;
  for (const p of props) n += homePropCost(p.id);
  return n;
}

export function defaultHomeLayout(x?: number, z?: number): HomeLayout {
  const a = apartmentAnchorXZ();
  return {
    plotX: x ?? a.x,
    plotZ: z ?? a.z,
    yaw: 0,
    tier: 'cottage',
    color: 0,
    props: [],
    rooms: [{ kind: 'living', lx: 0, lz: 0, yaw: 0 }],
    built: false,
  };
}

/** Plot must stay on the home island pad (grows with tier). */
export function isValidHomePlot(x: number, z: number, tier: HomeTier): boolean {
  const a = apartmentAnchorXZ();
  const t = homeTierDef(tier);
  const reach = Math.hypot(t.padW, t.padD) * 0.42 + 6;
  return Math.hypot(x - a.x, z - a.z) <= reach;
}

function box(
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function addHomePropMesh(
  g: THREE.Group,
  id: string,
  lx: number,
  lz: number,
  yaw: number,
  wood: THREE.Material,
  accent: THREE.Material,
  cloth: THREE.Material,
) {
  const local = new THREE.Group();
  local.position.set(lx, 0, lz);
  local.rotation.y = yaw;
  switch (id) {
    case 'planters':
      local.add(box(wood, 1.2, 0.45, 0.55, 0, 0.3, 0));
      local.add(box(cloth, 1.0, 0.35, 0.4, 0, 0.65, 0));
      break;
    case 'lanterns':
      local.add(box(accent, 0.15, 1.4, 0.15, -0.6, 0.8, 0));
      local.add(box(accent, 0.15, 1.4, 0.15, 0.6, 0.8, 0));
      local.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xffe8a0,
            emissive: 0xffcc66,
            emissiveIntensity: 0.7,
          }),
        ),
      );
      local.children[2]!.position.set(-0.6, 1.55, 0);
      break;
    case 'banners':
      local.add(box(accent, 0.12, 2.4, 0.12, 0, 1.3, 0));
      local.add(box(cloth, 1.1, 1.4, 0.08, 0.55, 1.5, 0));
      break;
    case 'benches':
      local.add(box(wood, 1.8, 0.35, 0.55, 0, 0.4, 0));
      local.add(box(wood, 1.8, 0.55, 0.12, 0, 0.75, -0.22));
      break;
    case 'fountain':
      local.add(box(accent, 1.6, 0.35, 1.6, 0, 0.25, 0));
      local.add(box(cloth, 0.55, 1.1, 0.55, 0, 0.9, 0));
      break;
    case 'statue':
      local.add(box(accent, 0.7, 0.3, 0.7, 0, 0.2, 0));
      local.add(box(accent, 0.45, 1.6, 0.45, 0, 1.1, 0));
      break;
    case 'trellis':
      local.add(box(wood, 2.2, 2.0, 0.12, 0, 1.1, 0));
      local.add(box(cloth, 2.0, 1.6, 0.08, 0, 1.1, 0.08));
      break;
    case 'chimney':
      local.add(box(wood, 0.7, 2.8, 0.7, 0, 1.5, 0));
      local.add(box(accent, 0.85, 0.25, 0.85, 0, 3.0, 0));
      break;
    default:
      local.add(box(wood, 0.8, 0.8, 0.8, 0, 0.45, 0));
  }
  g.add(local);
}

/** Rotate an AABB around Y then translate into plot-local space. */
function offsetYawCollider(c: Collider, lx: number, lz: number, yaw: number): Collider {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const corners = [
    new THREE.Vector3(c.min.x, c.min.y, c.min.z),
    new THREE.Vector3(c.max.x, c.min.y, c.min.z),
    new THREE.Vector3(c.min.x, c.min.y, c.max.z),
    new THREE.Vector3(c.max.x, c.min.y, c.max.z),
    new THREE.Vector3(c.min.x, c.max.y, c.min.z),
    new THREE.Vector3(c.max.x, c.max.y, c.min.z),
    new THREE.Vector3(c.min.x, c.max.y, c.max.z),
    new THREE.Vector3(c.max.x, c.max.y, c.max.z),
  ].map((p) => {
    const rx = p.x * cos - p.z * sin;
    const rz = p.x * sin + p.z * cos;
    return new THREE.Vector3(lx + rx, p.y, lz + rz);
  });
  const min = corners[0]!.clone();
  const max = corners[0]!.clone();
  for (const p of corners) {
    min.min(p);
    max.max(p);
  }
  return { min, max, kind: c.kind };
}

function roomLocalPoint(lx: number, lz: number, yaw: number, ox: number, oy: number, oz: number): THREE.Vector3 {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return new THREE.Vector3(lx + ox * cos - oz * sin, oy, lz + ox * sin + oz * cos);
}

/** Snap yaw to 90° so AABB wall colliders keep a clear door gap. */
export function snapHomeYaw(yaw: number): number {
  const step = Math.PI / 2;
  return Math.round(yaw / step) * step;
}

/** Resolve wing positions (auto-ring if still at origin). Mutates a copy. */
export function resolveHomeRooms(rooms: HomeRoom[], tier: HomeTier): HomeRoom[] {
  const t = homeTierDef(tier);
  const list = rooms.map((r) => ({ ...r }));
  const wings = list.filter((r) => r.kind !== 'living');
  for (const placed of list) {
    if (placed.kind === 'living') {
      placed.lx = 0;
      placed.lz = 0;
      placed.yaw = 0;
      continue;
    }
    if (Math.abs(placed.lx) < 0.1 && Math.abs(placed.lz) < 0.1) {
      const idx = wings.indexOf(placed);
      const a = (idx / Math.max(1, wings.length)) * Math.PI * 2 - Math.PI / 2;
      const rad = t.padW * 0.28;
      placed.lx = Math.cos(a) * rad;
      placed.lz = Math.sin(a) * rad;
    }
    placed.yaw = snapHomeYaw(placed.yaw);
  }
  return list;
}

/** Fade structure walls so interior décor aiming is visible. */
export function setHomeStructureTranslucent(root: THREE.Object3D | null | undefined, on: boolean) {
  if (!root) return;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.userData?.structureWall) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!('opacity' in sm)) continue;
      if (on) {
        if (sm.userData._homeOpaqueOpacity == null) {
          sm.userData._homeOpaqueOpacity = sm.opacity ?? 1;
          sm.userData._homeOpaqueDepth = sm.depthWrite;
        }
        sm.transparent = true;
        sm.opacity = 0.22;
        sm.depthWrite = false;
      } else if (sm.userData._homeOpaqueOpacity != null) {
        sm.opacity = sm.userData._homeOpaqueOpacity;
        sm.depthWrite = !!sm.userData._homeOpaqueDepth;
        sm.transparent = sm.opacity < 0.99;
        delete sm.userData._homeOpaqueOpacity;
        delete sm.userData._homeOpaqueDepth;
      }
    }
  });
}

function liftCollider(c: Collider, dy: number): Collider {
  return {
    min: new THREE.Vector3(c.min.x, c.min.y + dy, c.min.z),
    max: new THREE.Vector3(c.max.x, c.max.y + dy, c.max.z),
    kind: c.kind,
  };
}

function addRoomWing(
  g: THREE.Group,
  cols: Collider[],
  room: HomeRoom,
  mats: Mats,
  wood: THREE.Material,
  accent: THREE.Material,
  cloth: THREE.Material,
  contentY: number,
): { interactLocal?: THREE.Vector3; interactKind?: HomeRoomKind } {
  const wing = new THREE.Group();
  wing.position.set(room.lx, 0, room.lz);
  wing.rotation.y = room.yaw;
  const out: { interactLocal?: THREE.Vector3; interactKind?: HomeRoomKind } = {};

  if (room.kind === 'garden') {
    wing.add(box(cloth, 5.5, 0.12, 5.5, 0, 0.1, 0));
    wing.add(box(wood, 0.35, 1.2, 0.35, -2.2, 0.7, -2.2));
    wing.add(box(wood, 0.35, 1.2, 0.35, 2.2, 0.7, -2.2));
    wing.add(box(cloth, 1.2, 0.8, 1.2, 0, 0.55, 0));
    g.add(wing);
    cols.push(
      liftCollider(
        offsetYawCollider(
          {
            min: new THREE.Vector3(-2.75, 0, -2.75),
            max: new THREE.Vector3(2.75, 0.2, 2.75),
            kind: 'floor',
          },
          room.lx,
          room.lz,
          room.yaw,
        ),
        contentY,
      ),
    );
    return out;
  }

  const label =
    room.kind === 'workshop'
      ? 'WORKSHOP'
      : room.kind === 'invent_lab'
        ? 'INVENT LAB'
        : room.kind === 'gallery'
          ? 'GALLERY'
          : 'LIVING';
  const shell = buildEnterableShell(room.kind === 'workshop' || room.kind === 'invent_lab' ? 'office' : 'home', mats, {
    floors: 1,
    color: (wood as THREE.MeshStandardMaterial).color?.getHex?.() ?? 0x6a5848,
    label,
  });
  wing.add(shell.group);
  if (room.kind === 'workshop') {
    wing.add(box(accent, 2.4, 0.95, 1.0, 0, 0.6, 1.4));
    out.interactLocal = roomLocalPoint(room.lx, room.lz, room.yaw, 0, contentY + 1.15, 2.0);
    out.interactKind = 'workshop';
  } else if (room.kind === 'invent_lab') {
    wing.add(box(accent, 2.0, 1.1, 1.2, 0, 0.7, 1.2));
    wing.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x88e0ff,
          emissive: 0x44aacc,
          emissiveIntensity: 0.65,
        }),
      ),
    );
    wing.children[wing.children.length - 1]!.position.set(0.8, 1.5, 1.0);
    out.interactLocal = roomLocalPoint(room.lx, room.lz, room.yaw, 0, contentY + 1.15, 1.9);
    out.interactKind = 'invent_lab';
  } else if (room.kind === 'gallery') {
    wing.add(box(wood, 2.8, 1.6, 0.2, 0, 1.2, -2.2));
    wing.add(box(accent, 1.2, 1.0, 0.15, -1.4, 1.2, -2.15));
  } else {
    wing.add(box(wood, 1.6, 0.45, 0.8, 1.2, 0.4, -1.0));
  }
  g.add(wing);
  for (const c of shell.colliders) {
    // Ground floor of wing is covered by home pad — keep upper floors + solids
    if (c.kind === 'floor' && c.max.y < 1.0) continue;
    cols.push(liftCollider(offsetYawCollider(c, room.lx, room.lz, room.yaw), contentY));
  }
  return out;
}

export type HomeVisualBuilt = {
  group: THREE.Group;
  colliders: Collider[];
  /** Door / manage interact */
  interactLocal: THREE.Vector3;
  /** Interior décor interact (plot-local) */
  decorateLocal: THREE.Vector3;
  /** Functional room interacts (local to plot) */
  roomInteracts: { kind: HomeRoomKind; local: THREE.Vector3 }[];
};

export type BuildHomeVisualOpts = {
  /** Show ENTRY doorway cue (site-builder ghost only). Omit/false on finalized homes. */
  loudDoorCue?: boolean;
};

/** Build home at local origin (plot center). Caller sets group position/yaw. */
export function buildHomeVisual(
  mats: Mats,
  layout: HomeLayout,
  opts?: BuildHomeVisualOpts,
): HomeVisualBuilt {
  const g = new THREE.Group();
  g.name = 'PlayerHomeBuild';
  g.userData.homeBuild = true;
  const cols: Collider[] = [];
  const tier = homeTierDef(layout.tier);
  const pal = HOME_COLORS[layout.color % HOME_COLORS.length]!;
  const woodM = new THREE.MeshStandardMaterial({
    color: pal.wood,
    roughness: 0.75,
    metalness: 0.12,
  });
  const accentM = new THREE.MeshStandardMaterial({
    color: pal.accent,
    roughness: 0.45,
    metalness: 0.35,
  });
  const clothM = new THREE.MeshStandardMaterial({
    color: pal.cloth,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Island pad grows with tier — thick walkable deck
  g.add(box(woodM, tier.padW, HOME_PAD_THICK, tier.padD, 0, HOME_PAD_Y, 0));
  cols.push({
    min: new THREE.Vector3(
      -tier.padW / 2 - 0.15,
      HOME_PAD_Y - HOME_PAD_THICK / 2 - 0.08,
      -tier.padD / 2 - 0.15,
    ),
    max: new THREE.Vector3(tier.padW / 2 + 0.15, HOME_PAD_TOP, tier.padD / 2 + 0.15),
    kind: 'floor',
  });

  const content = new THREE.Group();
  content.name = 'HomeContent';
  content.position.y = HOME_CONTENT_Y;
  g.add(content);
  const dy = HOME_CONTENT_Y;

  const main = buildEnterableShell('home', mats, {
    floors: tier.floors,
    color: pal.wood,
    label: layout.tier === 'island' ? 'YOUR ISLAND' : 'YOUR HOME',
  });
  const scale =
    layout.tier === 'cottage'
      ? 1
      : layout.tier === 'house'
        ? 1.15
        : layout.tier === 'manor'
          ? 1.35
          : layout.tier === 'estate'
            ? 1.55
            : 1.75;
  main.group.scale.set(scale, 1, scale);
  content.add(main.group);
  for (const c of main.colliders) {
    // Pad is the ground walk plane; keep upper floors + wall solids
    if (c.kind === 'floor' && c.max.y < 1.0) continue;
    cols.push({
      min: new THREE.Vector3(c.min.x * scale, c.min.y + dy, c.min.z * scale),
      max: new THREE.Vector3(c.max.x * scale, c.max.y + dy, c.max.z * scale),
      kind: c.kind,
    });
  }

  const doorZ = main.doorWorld.z * scale;
  // ENTRY arch only while aiming/placing — strip it after finalize
  if (opts?.loudDoorCue) {
    addFrontDoorCue(content, doorZ, {
      doorW: 2.6 * scale,
      label: 'ENTRY',
      loud: true,
      y: 0,
    });
  }

  const roomInteracts: { kind: HomeRoomKind; local: THREE.Vector3 }[] = [];
  const rooms = resolveHomeRooms(
    layout.rooms?.length ? layout.rooms : [{ kind: 'living', lx: 0, lz: 0, yaw: 0 }],
    layout.tier,
  );

  for (const room of rooms) {
    if (room.kind === 'living') continue;
    const info = addRoomWing(content, cols, room, mats, woodM, accentM, clothM, dy);
    if (info.interactLocal && info.interactKind) {
      roomInteracts.push({ kind: info.interactKind, local: info.interactLocal });
    }
  }

  for (const p of layout.props ?? []) {
    addHomePropMesh(content, p.id, p.lx, p.lz, p.yaw, woodM, accentM, clothM);
  }

  return {
    group: g,
    colliders: cols,
    interactLocal: new THREE.Vector3(0, dy + 1.2, doorZ),
    decorateLocal: new THREE.Vector3(
      main.interiorSpot.x * scale,
      dy + main.interiorSpot.y,
      main.interiorSpot.z * scale,
    ),
    roomInteracts,
  };
}

export function worldHomeColliders(
  built: HomeVisualBuilt,
  wx: number,
  wz: number,
  yaw: number,
): Collider[] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return built.colliders.map((c) => {
    const corners = [
      new THREE.Vector3(c.min.x, c.min.y, c.min.z),
      new THREE.Vector3(c.max.x, c.min.y, c.min.z),
      new THREE.Vector3(c.min.x, c.min.y, c.max.z),
      new THREE.Vector3(c.max.x, c.min.y, c.max.z),
      new THREE.Vector3(c.min.x, c.max.y, c.min.z),
      new THREE.Vector3(c.max.x, c.max.y, c.min.z),
      new THREE.Vector3(c.min.x, c.max.y, c.max.z),
      new THREE.Vector3(c.max.x, c.max.y, c.max.z),
    ].map((p) => {
      const rx = p.x * cos - p.z * sin;
      const rz = p.x * sin + p.z * cos;
      return new THREE.Vector3(wx + rx, p.y, wz + rz);
    });
    const min = corners[0]!.clone();
    const max = corners[0]!.clone();
    for (const p of corners) {
      min.min(p);
      max.max(p);
    }
    return { min, max, kind: c.kind };
  });
}
