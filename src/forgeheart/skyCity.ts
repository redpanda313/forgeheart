/**
 * Phase 3 SP — empire-scale Sky City (~20× prior mega city footprint).
 * Multi-district floating islands. No solid roads between islands —
 * only glowing wind skyways for the surfboard (see reference wind-paths art).
 */

import * as THREE from 'three';
import { makeMaterials, type Mats } from './materials';
import type { Collider } from './level';
import {
  VENDORS,
  CITY_DISTRICTS,
  harvestBiomeForDistrict,
  type VendorDef,
  type CityDistrictDef,
  type CommodityId,
} from './economy';
import { buildPrefab } from './cityEditor';
import { CATALOG, type CatalogEntry } from './editorCatalog';
import { buildMapSnapshot, type MapSnapshot } from './cityMap';
import { makeIslandImpostor, type StreamChunk } from './cityStreamer';
import { makeKitNpc, tickNpcAnim, type NpcMeshParts, type NpcVisualRole } from './npcKit';
import { buildEnterableShell, offsetColliders } from './enterableBuilding';
import { buildPlazaCircuit, type PlazaCircuit } from './plazaCircuit';
import { RobotUnit } from './robot';
import { makeSignSprite, setSignWorldWidth } from './signLabel';
import {
  buildFlowerPatchMesh,
  flowerDisplayName,
  flowerPatchesForDistrict,
} from './flowers';
export type CityInteractKind =
  | 'neighbor'
  | 'vendor'
  | 'workshop_lease'
  | 'workshop_chest'
  | 'board_shop'
  /** Downed/hostile city work robot (fix Hand / harvest E) */
  | 'city_robot'
  | 'ferry_training'
  | 'harvest'
  | 'flower_pick'
  | 'broker'
  | 'city_stall'
  | 'craft_bench'
  | 'hire_board'
  | 'bay_expand'
  | 'invent_desk'
  | 'repair_job'
  | 'storage_office'
  | 'romance_npc'
  | 'npc_home'
  | 'buy_robot'
  | 'assign_medallion'
  | 'circuit_start'
  | 'player_home'
  | 'home_workshop'
  | 'home_invent'
  | 'home_decorate';

/** Plaza work a city chassis is assigned to while owned. */
export type CityRobotJobId =
  | 'haul'
  | 'repair'
  | 'courier'
  | 'vendor_assist'
  | 'dock'
  | 'yard';

export const CITY_ROBOT_JOBS: { id: CityRobotJobId; label: string }[] = [
  { id: 'haul', label: 'Haul' },
  { id: 'repair', label: 'Field repair' },
  { id: 'courier', label: 'Courier' },
  { id: 'vendor_assist', label: 'Stall assist' },
  { id: 'dock', label: 'Dock work' },
  { id: 'yard', label: 'Yard duty' },
];

export type CityRobotOwnerKind = 'player' | 'npc';

export interface CityRobotOwner {
  kind: CityRobotOwnerKind;
  id: string;
  name: string;
}

export interface CityInteract {
  id: string;
  kind: CityInteractKind;
  position: THREE.Vector3;
  radius: number;
  mesh: THREE.Object3D;
  vendor?: VendorDef;
  label: string;
  /** Neighbor dialogue lines */
  lines?: string[];
  /** For multi-plaza stalls */
  districtId?: string;
  /** Specialized harvest mat pool for this reef */
  harvestPool?: CommodityId[];
  harvestName?: string;
  /** Bonded storage office track */
  storageTrack?: 'resources' | 'crafted' | 'inventions';
}

export interface DistrictBuilt {
  def: CityDistrictDef;
  center: THREE.Vector3;
  stallMesh: THREE.Object3D | null;
  /** Per-district scene graph for streaming */
  group: THREE.Group;
  colliders: Collider[];
}

/** Tall plaza warning light — lit only while that island has a rogue robot. */
export interface RogueBeaconHandle {
  districtId: string;
  root: THREE.Group;
  bulbMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.MeshBasicMaterial;
  lit: boolean;
}

export interface CityNpc {
  mesh: THREE.Group;
  parts?: NpcMeshParts;
  /** Shared RobotUnit chassis for city work robots */
  robot?: RobotUnit;
  home: THREE.Vector3;
  work: THREE.Vector3;
  market: THREE.Vector3;
  /** 0 walk home, 1 work, 2 market — driven by day phase */
  role: 'resident' | 'flyer' | 'robot_helper' | 'rogue' | 'girl' | 'vendor';
  visual: NpcVisualRole;
  phase: number;
  speed: number;
  /** Temporary hostile state — any owned work robot may go rogue */
  rogue?: boolean;
  repairCd?: number;
  /** Accumulator for budgeted mid-range ticks */
  lodAcc?: number;
  /** Stable id for named / romance NPCs */
  id?: string;
  displayName?: string;
  /** Enterable home world position */
  homeInterior?: THREE.Vector3;
  insideHome?: boolean;
  romance?: boolean;
  giftLines?: string[];
  /** Plaza leash — keep walkers / rogues on their island deck */
  plazaCx: number;
  plazaCz: number;
  plazaRadius: number;
  /** Standing height on plaza floor (never fall through deck) */
  deckY: number;
  homeDistrictId?: string;
  /** Flyer skyway travel */
  skyRoute?: SkyRoute | null;
  routeIndex?: number;
  /** Who owns this chassis (player crew or an NPC employer). */
  owner?: CityRobotOwner;
  /** Job the robot performs while working (not a rogue). */
  jobId?: CityRobotJobId;
  /** Seconds of immunity after a fix before another rogue roll. */
  rogueImmuneT?: number;
  /** Links to InventoryState.workers id when owner.kind === 'player'. */
  workerId?: string;
}

export interface SkyRoute {
  path: THREE.Vector3[];
  pathDist: number[];
}

export interface SkyCityBuilt {
  group: THREE.Group;
  colliders: Collider[];
  mats: Mats;
  /** Player apartment feet spawn */
  apartmentSpawn: THREE.Vector3;
  /** Player home visual root (rebuilt from apartmentLayout) */
  apartmentGroup: THREE.Group;
  /** Home island anchor XZ */
  apartmentAnchor: THREE.Vector3;
  interactables: CityInteract[];
  npcs: CityNpc[];
  skyRoutes: SkyRoute[];
  workshopGroup: THREE.Group;
  /**
   * Empire bay expand yards — separate island from workshop/home (Sky Foundry).
   * Visible once city workshop (or parcel) is leased.
   */
  expandYardGroup: THREE.Group;
  /** Legacy single stall group (grand market); multi-stall via cityStalls map */
  stallGroup: THREE.Group;
  /** Per-district stall visuals */
  districtStallGroups: Record<string, THREE.Group>;
  /** Player factory visuals: storage_resources|crafted|inventions, bay_wing */
  factoryGroups: Record<string, THREE.Group>;
  districts: DistrictBuilt[];
  /** Tall red warning beacons (always resident — visible across the city) */
  rogueBeacons: RogueBeaconHandle[];
  /** Light beacons only for plazas that currently have a rogue robot */
  setPlazaRogueBeacons: (activeDistrictIds: Iterable<string>) => void;
  /** Streaming chunks (districts + resident skyways/hub) */
  streamChunks: StreamChunk[];
  harvestSpot: THREE.Vector3;
  residentialPlaza: THREE.Vector3;
  grandMarket: THREE.Vector3;
  industrial: THREE.Vector3;
  /** Live world → map projection data (rebuilds with city) */
  mapSnapshot: MapSnapshot;
  /** Player XZ for NPC/skyway LOD (updated each frame from game) */
  setLodFocus: (x: number, z: number) => void;
  animate: (cityTime: number, dt: number) => void;
  /** Count of NPCs that received a full update this frame */
  lastNpcActive: number;
  lowestY: number;
  /** Theme-park board circuits */
  circuits: PlazaCircuit[];
  /** Broker frame display groups by district */
  brokerDisplays: Record<string, THREE.Group>;
}

function hashDistrictFlower(districtId: string, flowerId: string, index: number): number {
  const s = `${districtId}:${flowerId}:${index}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function labelSprite(text: string): THREE.Sprite {
  return makeSignSprite(text, {
    width: 320,
    maxWidth: 720,
    height: 64,
    maxHeight: 200,
    maxFont: 20,
    minFont: 11,
    fontFamily: 'system-ui,sans-serif',
    fill: 'rgba(12,16,24,0.8)',
    stroke: '#c4a35a',
    textColor: '#f0e0b0',
    worldWidth: 3.4,
  });
}

/** Deck thickness + collider padding so snap/land never miss thin tops */
const FLOOR_THICK = 0.55;
/** Collider extends slightly past visual deck for reliable feet contact */
const FLOOR_COL_PAD = 0.12;

function floorPad(
  _mats: Mats,
  w: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color = 0x5a5348,
): { mesh: THREE.Mesh; col: Collider } {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.65 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, FLOOR_THICK, d), mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const halfH = FLOOR_THICK / 2;
  const top = y + halfH + FLOOR_COL_PAD;
  const bot = y - halfH - 0.08;
  const col: Collider = {
    min: new THREE.Vector3(x - w / 2 - 0.15, bot, z - d / 2 - 0.15),
    max: new THREE.Vector3(x + w / 2 + 0.15, top, z + d / 2 + 0.15),
    kind: 'floor',
  };
  return { mesh, col };
}

function catalogEntry(category: CatalogEntry['category'], variant: number): CatalogEntry {
  return (
    CATALOG.find((e) => e.category === category && e.variant === variant) ?? {
      category,
      variant,
      label: `${category}_${variant}`,
      defaultScale: 1,
    }
  );
}

/** Place Game Maker / raceway prefab as pure scenery (no colliders for soft props). */
function placeScenery(
  group: THREE.Group,
  mats: Mats,
  category: CatalogEntry['category'],
  variant: number,
  x: number,
  z: number,
  y = 0.35,
  scale = 1,
  yaw = 0,
  colliders?: Collider[],
  solidBuilding = false,
): void {
  const entry = catalogEntry(category, variant);
  const root = buildPrefab(entry, mats);
  root.position.set(x, y, z);
  root.rotation.y = yaw;
  root.scale.setScalar(scale);
  group.add(root);
  if (colliders && (solidBuilding || category === 'building')) {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      colliders.push({
        min: box.min.clone(),
        max: box.max.clone(),
        kind: 'solid',
      });
    }
  }
  // Walkable ground platforms from catalog
  if (colliders && category === 'ground') {
    const box = new THREE.Box3().setFromObject(root);
    if (!box.isEmpty()) {
      colliders.push({
        min: box.min.clone(),
        max: new THREE.Vector3(box.max.x, box.min.y + 0.45, box.max.z),
        kind: 'floor',
      });
    }
  }
}

function solidBox(
  _mats: Mats,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): { mesh: THREE.Mesh; col: Collider } {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  const col: Collider = {
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    kind: 'solid',
  };
  return { mesh, col };
}

function pathDist(path: THREE.Vector3[]): number[] {
  const d = [0];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    acc += path[i]!.distanceTo(path[i - 1]!);
    d.push(acc);
  }
  return d;
}

/** Random point on a plaza deck (stays well inside the floor pad). */
function plazaPoint(d: { x: number; z: number; size: number }, spread = 0.42): THREE.Vector3 {
  const r = d.size * spread;
  const a = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * r;
  return new THREE.Vector3(d.x + Math.cos(a) * rad, 0, d.z + Math.sin(a) * rad);
}

function clampToPlaza(
  pos: THREE.Vector3,
  cx: number,
  cz: number,
  plazaSize: number,
  y = 0,
) {
  const maxR = plazaSize * 0.46;
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist > maxR && dist > 1e-6) {
    pos.x = cx + (dx / dist) * maxR;
    pos.z = cz + (dz / dist) * maxR;
  }
  pos.y = y;
}

/** Top of a district plaza floor pad (matches floorPad collider max.y). */
export function plazaDeckStandY(deckY = 0.2): number {
  return deckY + FLOOR_THICK / 2 + FLOOR_COL_PAD;
}

const NPC_ROBOT_OWNERS = [
  'Pip Harper',
  'Sera Quinn',
  'Bolt Voss',
  'Lira Voss',
  'Mira Quinn',
  'Nova Hale',
  'Sage Wren',
  'Harbor Guild',
  'Market Consortium',
  'Sky Foundry Co.',
  'Spore Gardens LLC',
  'Aether Spire Yard',
];

function pickCityRobotJob(districtRole: CityDistrictDef['role'], i: number): CityRobotJobId {
  if (districtRole === 'harbor') return i % 2 === 0 ? 'dock' : 'haul';
  if (districtRole === 'market' || districtRole === 'premium') {
    return (['vendor_assist', 'courier', 'haul'] as CityRobotJobId[])[i % 3]!;
  }
  if (districtRole === 'industrial') {
    return (['yard', 'repair', 'haul'] as CityRobotJobId[])[i % 3]!;
  }
  return (['courier', 'haul', 'yard', 'repair'] as CityRobotJobId[])[i % 4]!;
}

function jobLabel(jobId: CityRobotJobId): string {
  return CITY_ROBOT_JOBS.find((j) => j.id === jobId)?.label ?? jobId;
}

/**
 * Spawn one owned work robot onto a built city (NPC or player crew).
 * Always starts working — never as a dedicated rogue spawn.
 */
export function attachCityWorkRobot(
  city: SkyCityBuilt,
  opts: {
    id: string;
    displayName: string;
    district: CityDistrictDef;
    owner: CityRobotOwner;
    jobId: CityRobotJobId;
    workerId?: string;
  },
): CityNpc {
  const deckY = plazaDeckStandY(0.2);
  const spawn = plazaPoint(opts.district, 0.4);
  spawn.y = deckY;
  const work = plazaPoint(opts.district, 0.36);
  work.y = deckY;
  const market = plazaPoint(opts.district, 0.34);
  market.y = deckY;
  const robot = new RobotUnit(city.mats, spawn.clone());
  robot.displayName = opts.displayName;
  robot.setPhase('ally');
  robot.onGround = true;
  robot.vy = 0;
  city.group.add(robot.mesh);

  const mark = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x66cc88,
      emissive: 0x228844,
      emissiveIntensity: 0.55,
    }),
  );
  mark.position.set(spawn.x, deckY + 1.25, spawn.z + 1.15);
  mark.visible = false;
  city.group.add(mark);
  city.interactables.push({
    id: opts.id,
    kind: 'city_robot',
    position: mark.position.clone(),
    radius: 2.6,
    mesh: mark,
    label: `${opts.displayName} · ${jobLabel(opts.jobId)} · ${opts.owner.name}`,
  });

  const npc: CityNpc = {
    mesh: robot.mesh,
    robot,
    home: spawn.clone(),
    work,
    market,
    role: 'robot_helper',
    visual: 'robot_helper',
    phase: Math.random(),
    speed: 2.35 + Math.random() * 0.6,
    rogue: false,
    plazaCx: opts.district.x,
    plazaCz: opts.district.z,
    plazaRadius: opts.district.size,
    deckY,
    homeDistrictId: opts.district.id,
    id: opts.id,
    displayName: opts.displayName,
    owner: opts.owner,
    jobId: opts.jobId,
    rogueImmuneT: 45 + Math.random() * 90,
    workerId: opts.workerId,
  };
  city.npcs.push(npc);
  return npc;
}

/** Pick sky route whose ends are near from→to district centers. */
function pickSkyRoute(
  routes: SkyRoute[],
  from: THREE.Vector3,
  to: THREE.Vector3,
): SkyRoute | null {
  let best: SkyRoute | null = null;
  let bestScore = Infinity;
  for (const r of routes) {
    if (r.path.length < 2) continue;
    const a = r.path[0]!;
    const b = r.path[r.path.length - 1]!;
    const forward =
      a.distanceToSquared(from) + b.distanceToSquared(to);
    const reverse =
      b.distanceToSquared(from) + a.distanceToSquared(to);
    const score = Math.min(forward, reverse);
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore < 180 * 180 * 2 ? best : null;
}

function nearestRouteIndex(path: THREE.Vector3[], pos: THREE.Vector3): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = path[i]!.distanceToSquared(pos);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

const NPC_PLANE_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
})();

function makeNpcMesh(
  role: CityNpc['role'],
  mats: Mats,
  rogue = false,
  variant = 0,
): NpcMeshParts {
  const visual: NpcVisualRole = rogue
    ? 'rogue'
    : role === 'flyer'
      ? 'flyer'
      : role === 'robot_helper'
        ? 'robot_helper'
        : role === 'girl'
          ? 'girl'
          : role === 'vendor'
            ? 'vendor'
            : 'resident';
  return makeKitNpc(visual, mats, { variant });
}

/**
 * Build the empire-scale mega-city from CITY_DISTRICTS.
 * Prior city was ~±250; this spans ~±520 with 14 plazas + connectors (~20× area).
 */
export function buildSkyCity(): SkyCityBuilt {
  const mats = makeMaterials();
  const group = new THREE.Group();
  group.name = 'SkyCity';
  const colliders: Collider[] = [];
  const interactables: CityInteract[] = [];
  const npcs: CityNpc[] = [];
  const districts: DistrictBuilt[] = [];
  const districtStallGroups: Record<string, THREE.Group> = {};
  const streamChunks: StreamChunk[] = [];
  const districtBag = new Map<string, { group: THREE.Group; cols: Collider[] }>();
  const circuits: PlazaCircuit[] = [];
  const brokerDisplays: Record<string, THREE.Group> = {};
  let lowestY = 0;
  let lodFocusX = 0;
  let lodFocusZ = 0;

  // Resident layers: skyways always loaded; hub extras stay near residential spawn
  const skywayGroup = new THREE.Group();
  skywayGroup.name = 'Skyways';
  group.add(skywayGroup);
  const skywayCols: Collider[] = [];
  const hubGroup = new THREE.Group();
  hubGroup.name = 'HubResidential';
  group.add(hubGroup);
  const hubCols: Collider[] = [];
  const impostorGroup = new THREE.Group();
  impostorGroup.name = 'IslandImpostors';
  group.add(impostorGroup);
  // Always-resident rogue warning lights (must stay visible when plazas stream out)
  const rogueBeaconGroup = new THREE.Group();
  rogueBeaconGroup.name = 'RogueBeacons';
  group.add(rogueBeaconGroup);
  const rogueBeacons: RogueBeaconHandle[] = [];
  const ROGUE_BEACON_Y = 42;

  const scratchDest = new THREE.Vector3();
  const scratchDir = new THREE.Vector3();
  const scratchRight = new THREE.Vector3();
  const scratchPos = new THREE.Vector3();
  const scratchMat = new THREE.Matrix4();
  const scratchQuat = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();
  const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  type MeshSink = (m: THREE.Object3D) => void;
  type ColSink = (c: Collider) => void;
  let meshSink: MeshSink = (m) => group.add(m);
  let colSink: ColSink = (c) => {
    colliders.push(c);
    lowestY = Math.min(lowestY, c.min.y);
  };
  const addMesh = (m: THREE.Object3D) => meshSink(m);
  const addCol = (c: Collider) => colSink(c);

  const DECK_Y = 0.2;
  const byId = (id: string) => CITY_DISTRICTS.find((d) => d.id === id)!;
  const residential = byId('residential');
  const grand = byId('grand_market');
  const industrialDef = byId('industrial');
  lodFocusX = residential.x;
  lodFocusZ = residential.z;
  const residentialPlaza = new THREE.Vector3(residential.x, 0, residential.z);
  const grandMarket = new THREE.Vector3(grand.x, 0, grand.z);
  const industrial = new THREE.Vector3(industrialDef.x, 0, industrialDef.z);
  const apartmentPos = new THREE.Vector3(residential.x - 32, 0, residential.z + 20);

  const workshopGroup = new THREE.Group();
  workshopGroup.name = 'CityWorkshop';
  workshopGroup.visible = false;
  let stallGroup = new THREE.Group();
  stallGroup.name = 'CityStallLegacy';
  stallGroup.visible = false;
  const factoryGroups: Record<string, THREE.Group> = {};
  for (const key of ['storage_resources', 'storage_crafted', 'storage_inventions', 'bay_wing']) {
    const fg = new THREE.Group();
    fg.name = `Factory_${key}`;
    fg.visible = false;
    group.add(fg);
    factoryGroups[key] = fg;
  }

  /** Soft-edge wind texture (shared) — fades to transparent so planks don't look solid. */
  const windTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    // Soft horizontal streak with feathered edges
    const g = ctx.createRadialGradient(64, 32, 2, 64, 32, 58);
    g.addColorStop(0, 'rgba(220,250,255,0.95)');
    g.addColorStop(0.25, 'rgba(120,220,255,0.55)');
    g.addColorStop(0.55, 'rgba(60,180,255,0.22)');
    g.addColorStop(0.8, 'rgba(40,160,255,0.06)');
    g.addColorStop(1, 'rgba(30,140,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
    // Lengthwise fade so ends dissolve into air
    const lg = ctx.createLinearGradient(0, 0, 128, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.85)');
    lg.addColorStop(0.12, 'rgba(0,0,0,0)');
    lg.addColorStop(0.88, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, 128, 64);
    // Soft top/bottom edge feather
    const vg = ctx.createLinearGradient(0, 0, 0, 64);
    vg.addColorStop(0, 'rgba(0,0,0,0.9)');
    vg.addColorStop(0.2, 'rgba(0,0,0,0)');
    vg.addColorStop(0.8, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const windMatSoft = new THREE.MeshBasicMaterial({
    map: windTex,
    color: 0x88e8ff,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const windMatCore = new THREE.MeshBasicMaterial({
    map: windTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const windMatWhisp = new THREE.MeshBasicMaterial({
    map: windTex,
    color: 0xaaf0ff,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  // Must declare before windSkyway uses it (calls, not definition)
  const skyRoutes: SkyRoute[] = [];
  const skywayLods: { root: THREE.Object3D; x: number; z: number }[] = [];

  /**
   * Wind skyway — instanced ribbon planks + sparse board colliders.
   * Far links fade via distance LOD in animate().
   */
  function windSkyway(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    opts?: { arch?: number; width?: number; entryLift?: number },
  ) {
    const arch = opts?.arch ?? 10;
    const width = opts?.width ?? 9;
    const entryLift = opts?.entryLift ?? 0.85;
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) return;

    const ux = dx / dist;
    const uz = dz / dist;
    const px = -uz;
    const pz = ux;
    const curve = Math.min(28, dist * 0.12) * (Math.sin(ax * 0.01 + az * 0.007) > 0 ? 1 : -1);

    const a0 = new THREE.Vector3(ax + ux * 8, DECK_Y + entryLift, az + uz * 8);
    const b0 = new THREE.Vector3(bx - ux * 8, DECK_Y + entryLift, bz - uz * 8);
    const mid = new THREE.Vector3(
      (ax + bx) / 2 + px * curve,
      DECK_Y + entryLift + arch,
      (az + bz) / 2 + pz * curve,
    );
    const q1 = a0
      .clone()
      .lerp(mid, 0.45)
      .add(new THREE.Vector3(px * curve * 0.35, arch * 0.15, pz * curve * 0.35));
    const q2 = mid
      .clone()
      .lerp(b0, 0.55)
      .add(new THREE.Vector3(-px * curve * 0.35, arch * 0.1, -pz * curve * 0.35));

    const pts: THREE.Vector3[] = [];
    const segs = Math.max(12, Math.ceil(dist / 14));
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const u = 1 - t;
      pts.push(
        new THREE.Vector3()
          .addScaledVector(a0, u * u * u)
          .addScaledVector(q1, 3 * u * u * t)
          .addScaledVector(q2, 3 * u * t * t)
          .addScaledVector(b0, t * t * t),
      );
    }
    skyRoutes.push({ path: pts, pathDist: pathDist(pts) });

    const linkRoot = new THREE.Group();
    linkRoot.name = 'SkywayLink';
    skywayGroup.add(linkRoot);
    skywayLods.push({ root: linkRoot, x: (ax + bx) * 0.5, z: (az + bz) * 0.5 });

    // Collect instance transforms for 3 material layers
    type Inst = { mat: THREE.Matrix4 };
    const cores: Inst[] = [];
    const softs: Inst[] = [];
    const whisps: Inst[] = [];

    const plankCount = Math.max(14, Math.ceil(dist / 8));
    for (let i = 0; i < plankCount; i++) {
      const t = (i + 0.5) / plankCount;
      const gapSeed = Math.sin(i * 2.71 + ax * 0.03) * 0.5 + 0.5;
      if (gapSeed < 0.12) continue;

      const fi = t * (pts.length - 1);
      const i0 = Math.min(pts.length - 2, Math.floor(fi));
      const frac = fi - i0;
      const p0 = pts[i0]!;
      const p1 = pts[i0 + 1]!;
      scratchPos.copy(p0).lerp(p1, frac);
      scratchDir.copy(p1).sub(p0);
      if (scratchDir.lengthSq() < 1e-8) continue;
      scratchDir.normalize();
      scratchRight.set(-scratchDir.z, 0, scratchDir.x);
      if (scratchRight.lengthSq() < 1e-8) scratchRight.set(1, 0, 0);
      else scratchRight.normalize();

      const lanes = 2 + (i % 2); // 2–3 wisps (was 3–4 unique meshes)
      for (let L = 0; L < lanes; L++) {
        const lat =
          (L - (lanes - 1) / 2) * (width * 0.28) +
          Math.sin(i * 1.7 + L * 2.1) * (width * 0.06);
        const alongJit = Math.sin(i * 3.1 + L) * 0.9;
        const elevJit = Math.sin(i * 2.3 + L * 1.4) * 0.28;
        const plankLen = 3.2 + (i % 5) * 0.5 + L * 0.3;
        const plankW = 1.4 + (L % 3) * 0.4 + gapSeed * 0.5;

        const yaw = Math.atan2(scratchDir.x, scratchDir.z);
        const pitch = Math.atan2(scratchDir.y, Math.hypot(scratchDir.x, scratchDir.z));
        scratchEuler.set(-pitch, yaw, Math.sin(i * 1.9 + L * 2.4) * 0.1, 'YXZ');
        scratchQuat.setFromEuler(scratchEuler);
        scratchScale.set(plankW, 1, plankLen);
        scratchMat.compose(
          scratchPos
            .clone()
            .addScaledVector(scratchRight, lat)
            .addScaledVector(scratchDir, alongJit)
            .add(new THREE.Vector3(0, elevJit, 0)),
          scratchQuat,
          scratchScale,
        );
        const entry = { mat: scratchMat.clone() };
        if (L === 0) cores.push(entry);
        else if (L === 1) softs.push(entry);
        else whisps.push(entry);
      }

      if (i % 4 === 0) {
        for (const side of [-1, 1] as const) {
          const yaw = Math.atan2(scratchDir.x, scratchDir.z);
          const pitch = Math.atan2(scratchDir.y, Math.hypot(scratchDir.x, scratchDir.z));
          scratchEuler.set(-pitch, yaw, side * 0.18, 'YXZ');
          scratchQuat.setFromEuler(scratchEuler);
          scratchScale.set(0.75 + (i % 4) * 0.12, 1, 4.2 + (i % 3));
          scratchMat.compose(
            scratchPos
              .clone()
              .addScaledVector(scratchRight, side * (width * 0.4 + Math.sin(i) * 0.5))
              .add(new THREE.Vector3(0, 0.35 + Math.sin(i * 0.7) * 0.25, 0)),
            scratchQuat,
            scratchScale,
          );
          whisps.push({ mat: scratchMat.clone() });
        }
      }
    }

    const flushInstanced = (
      list: Inst[],
      mat: THREE.Material,
      renderOrder: number,
    ) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(NPC_PLANE_GEO, mat, list.length);
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      for (let i = 0; i < list.length; i++) mesh.setMatrixAt(i, list[i]!.mat);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = true;
      mesh.renderOrder = renderOrder;
      linkRoot.add(mesh);
    };
    flushInstanced(cores, windMatCore, 2);
    flushInstanced(softs, windMatSoft, 2);
    flushInstanced(whisps, windMatWhisp, 1);

    // Sparse skyway colliders (~every 28u of path) — path-snap style
    const colStride = Math.max(1, Math.ceil(28 / Math.max(1, dist / segs)));
    for (let i = 0; i < pts.length - 1; i += colStride) {
      const p0 = pts[i]!;
      const p1 = pts[Math.min(pts.length - 1, i + colStride)]!;
      const midY = (p0.y + p1.y) * 0.5;
      const halfW = width * 0.62;
      const top = midY + 0.25;
      const bot = midY - 0.7;
      const col: Collider = {
        min: new THREE.Vector3(
          Math.min(p0.x, p1.x) - halfW,
          bot,
          Math.min(p0.z, p1.z) - halfW,
        ),
        max: new THREE.Vector3(
          Math.max(p0.x, p1.x) + halfW,
          top,
          Math.max(p0.z, p1.z) + halfW,
        ),
        kind: 'skyway',
      };
      skywayCols.push(col);
      colliders.push(col);
      lowestY = Math.min(lowestY, col.min.y);
    }

    // Soft entry rings
    for (const p of [a0, b0]) {
      const beacon = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 2.6, 24),
        new THREE.MeshBasicMaterial({
          color: 0x88eeff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
      beacon.position.copy(p);
      beacon.rotation.x = -Math.PI / 2;
      beacon.renderOrder = 3;
      linkRoot.add(beacon);
    }
  }

  // Removed unused layFlatAlong (instanced ribbons set orientation via matrix)

  // ——— Every district plaza ———
  for (let di = 0; di < CITY_DISTRICTS.length; di++) {
    const d = CITY_DISTRICTS[di]!;
    const cx = d.x;
    const cz = d.z;
    const sz = d.size;
    const dGroup = new THREE.Group();
    dGroup.name = `District_${d.id}`;
    group.add(dGroup);
    const dCols: Collider[] = [];
    districtBag.set(d.id, { group: dGroup, cols: dCols });
    meshSink = (m) => dGroup.add(m);
    colSink = (c) => {
      dCols.push(c);
      colliders.push(c);
      lowestY = Math.min(lowestY, c.min.y);
    };

    const pad = floorPad(mats, sz, sz, cx, DECK_Y, cz, d.color);
    addMesh(pad.mesh);
    addCol(pad.col);

    const lab = labelSprite(d.name.toUpperCase());
    lab.position.set(cx, 4.2, cz + sz * 0.35);
    setSignWorldWidth(lab, 4.2);
    addMesh(lab);

    // Fountain / center piece
    const fountain = solidBox(mats, mats.brass, 3.5, 1.1, 3.5, cx, 0.9, cz);
    addMesh(fountain.mesh);
    addCol(fountain.col);

    // Only purposeful scenery — roomy plazas (no dense filler buildings)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const r = sz * 0.42;
      placeScenery(
        dGroup,
        mats,
        'tree',
        i % 5,
        cx + Math.cos(a) * r,
        cz + Math.sin(a) * r,
        0.4,
        1.1,
      );
    }
    // Edge lamps for readability
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + di * 0.1;
      const lx = cx + Math.cos(a) * (sz * 0.46);
      const lz = cz + Math.sin(a) * (sz * 0.46);
      const lamp = solidBox(mats, mats.brass, 0.18, 2.2, 0.18, lx, 1.3, lz);
      addMesh(lamp.mesh);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 6),
        new THREE.MeshStandardMaterial({
          color: 0xffe8a0,
          emissive: 0xffcc66,
          emissiveIntensity: 0.65,
        }),
      );
      glow.position.set(lx, 2.5, lz);
      addMesh(glow);
    }
    if (d.role === 'premium' || d.role === 'market') {
      placeScenery(dGroup, mats, 'fountain', di % 5, cx + 8, cz - 6, 0.4, 0.85);
    }
    // Industrial / harbor: one work vehicle (purposeful prop)
    if (d.role === 'industrial' || d.role === 'harbor') {
      placeScenery(dGroup, mats, 'vehicle', di % 5, cx - 14, cz + 8, 0.4, 1.0, 0.5);
    }

    // Stall lease marker — visual filled later from player layout
    const stallG = new THREE.Group();
    stallG.name = `Stall_${d.id}`;
    stallG.visible = false;
    dGroup.add(stallG);
    districtStallGroups[d.id] = stallG;
    if (d.id === 'grand_market') stallGroup = stallG;

    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff8866,
        emissive: 0xaa4422,
        emissiveIntensity: 0.55,
      }),
    );
    sm.position.set(cx + sz * 0.28, 1.3, cz + sz * 0.18);
    addMesh(sm);
    const sl = labelSprite(`STALL · ${d.stallCost}b · ${d.name}`);
    sl.position.set(cx + sz * 0.28, 2.9, cz + sz * 0.22);
    setSignWorldWidth(sl, 3.6);
    addMesh(sl);
    interactables.push({
      id: `stall_${d.id}`,
      kind: 'city_stall',
      position: sm.position.clone(),
      radius: 2.6,
      mesh: sm,
      label: `Retail stall · ${d.name} (${d.stallCost}b lease)`,
      districtId: d.id,
    });

    // Specialized harvest reefs — most districts have one (different mats by biome)
    if (
      d.role === 'harbor' ||
      d.role === 'industrial' ||
      d.role === 'premium' ||
      d.id === 'spore_gardens' ||
      d.id === 'south_docks' ||
      d.id === 'mid_ring_east' ||
      d.id === 'mid_ring_west' ||
      d.id === 'grand_market'
    ) {
      const biome = harvestBiomeForDistrict(d.id);
      const hx = cx - sz * 0.55;
      const hz = cz + (d.role === 'premium' ? 4 : 0);
      const reef = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 10.5, FLOOR_THICK, 10),
        new THREE.MeshStandardMaterial({ color: biome.color, roughness: 0.7 }),
      );
      reef.position.set(hx, DECK_Y, hz);
      addMesh(reef);
      addCol({
        min: new THREE.Vector3(hx - 11, DECK_Y - 0.4, hz - 11),
        max: new THREE.Vector3(hx + 11, DECK_Y + 0.4, hz + 11),
        kind: 'floor',
      });
      windSkyway(cx, cz, hx, hz, { arch: 6, width: 6.5 });
      const hm = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.08, 6, 16),
        new THREE.MeshStandardMaterial({
          color: 0x66d8ff,
          emissive: 0x2288cc,
          emissiveIntensity: 0.6,
        }),
      );
      hm.rotation.x = Math.PI / 2;
      hm.position.set(hx, 0.55, hz);
      addMesh(hm);
      const matNames = biome.mats.join('/');
      const hl = labelSprite(`${biome.name}`);
      hl.position.set(hx, 2.6, hz);
      setSignWorldWidth(hl, 3.6);
      addMesh(hl);
      interactables.push({
        id: `harvest_${d.id}`,
        kind: 'harvest',
        position: new THREE.Vector3(hx, 0.5, hz),
        radius: 3.5,
        mesh: hm,
        label: `Harvest · ${biome.name} (${matNames})`,
        districtId: d.id,
        harvestPool: [...biome.mats],
        harvestName: biome.name,
      });
    }

    // Plaza flower patches — one bloom type per patch; some plazas host two
    {
      const patches = flowerPatchesForDistrict(d.id, d.role);
      const offsets: Array<[number, number]> =
        patches.length > 1
          ? [
              [0.18, -0.2],
              [-0.2, 0.16],
            ]
          : [[0.18, -0.2]];
      patches.forEach((flowerId, pi) => {
        const [ox, oz] = offsets[pi] ?? offsets[0]!;
        const fx = cx + sz * ox;
        const fz = cz + sz * oz;
        const patch = buildFlowerPatchMesh(flowerId, {
          seed: hashDistrictFlower(d.id, flowerId, pi),
          count: 5 + (pi % 2),
          scale: 1.05,
        });
        patch.position.set(fx, 0, fz);
        addMesh(patch);
        const name = flowerDisplayName(flowerId);
        const fl = labelSprite(name.toUpperCase());
        fl.position.set(fx, 1.65, fz);
        setSignWorldWidth(fl, 2.6);
        addMesh(fl);
        interactables.push({
          id: `flowers_${d.id}_${flowerId}`,
          kind: 'flower_pick',
          position: new THREE.Vector3(fx, 0.5, fz),
          radius: 2.6,
          mesh: patch,
          label: `Pick ${name} (personality)`,
          districtId: d.id,
          harvestPool: [flowerId],
          harvestName: name,
        });
      });
    }

    // Vendors on market / premium / mixed plazas
    if (d.role === 'market' || d.role === 'premium' || d.role === 'mixed') {
      VENDORS.forEach((v, i) => {
        if (d.role === 'mixed' && i > 1) return;
        const a = (i / VENDORS.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * (sz * 0.22);
        const z = cz + Math.sin(a) * (sz * 0.22);
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.8 }),
        );
        body.position.set(x, 1.2, z);
        addMesh(body);
        const mark = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xc4a35a,
            emissive: 0x886622,
            emissiveIntensity: 0.4,
          }),
        );
        mark.position.set(x + 1.3, 1.1, z);
        addMesh(mark);
        const vl = labelSprite(v.name);
        vl.position.set(x, 2.6, z);
        addMesh(vl);
        interactables.push({
          id: `vendor_${d.id}_${v.id}`,
          kind: 'vendor',
          position: mark.position.clone(),
          radius: 2.3,
          mesh: mark,
          vendor: v,
          label: `${v.title} · ${v.name} (${d.name})`,
          districtId: d.id,
        });
      });
    }

    // Broker at industrial / grand market
    if (d.role === 'industrial' || d.id === 'grand_market') {
      const bx = cx + sz * 0.3;
      const bz = cz - sz * 0.25;
      const bot = solidBox(mats, mats.iron, 1.2, 1.8, 0.9, bx, 1.2, bz);
      addMesh(bot.mesh);
      const bm = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xaa88ff,
          emissive: 0x5533aa,
          emissiveIntensity: 0.5,
        }),
      );
      bm.position.set(bx, 1.2, bz + 2);
      addMesh(bm);
      const bl = labelSprite('FRAME BROKER');
      bl.position.set(bx, 3.2, bz);
      addMesh(bl);
      interactables.push({
        id: `broker_${d.id}`,
        kind: 'broker',
        position: bm.position.clone(),
        radius: 2.5,
        mesh: bm,
        label: `Sell robot frames · ${d.name}`,
        districtId: d.id,
      });
    }

    // One enterable NPC home per district (purposeful — owners visit)
    {
      const a = di * 0.7 + 0.8;
      const r = sz * 0.38;
      const hx = cx + Math.cos(a) * r;
      const hz = cz + Math.sin(a) * r;
      const shell = buildEnterableShell('home', mats, {
        floors: 1,
        color: d.color + 0x0a0a08,
        label: 'HOME',
      });
      shell.group.position.set(hx, 0, hz);
      shell.group.rotation.y = a + Math.PI;
      dGroup.add(shell.group);
      const worldCols = offsetColliders(shell.colliders, hx, 0, hz);
      for (const c of worldCols) {
        dCols.push(c);
        colliders.push(c);
        lowestY = Math.min(lowestY, c.min.y);
      }
      interactables.push({
        id: `home_${d.id}_0`,
        kind: 'npc_home',
        position: new THREE.Vector3(hx + shell.doorWorld.x, 1.2, hz + shell.doorWorld.z),
        radius: 2.2,
        mesh: shell.group,
        label: 'Enter home',
        districtId: d.id,
      });
    }

    // Theme-park board circuit
    if (d.themePark) {
      const circuit = buildPlazaCircuit(d.id, cx, cz, sz);
      dGroup.add(circuit.group);
      for (const c of circuit.colliders) {
        dCols.push(c);
        colliders.push(c);
      }
      circuits.push(circuit);
      const mark = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffaa44,
          emissive: 0xcc6622,
          emissiveIntensity: 0.55,
        }),
      );
      mark.position.copy(circuit.start);
      dGroup.add(mark);
      interactables.push({
        id: `circuit_${d.id}`,
        kind: 'circuit_start',
        position: circuit.start.clone(),
        radius: 3.5,
        mesh: mark,
        label: `Board Circuit · ${d.name}`,
        districtId: d.id,
      });
    }

    // placeScenery appends only to dCols — mirror into master collider list
    for (const c of dCols) {
      if (colliders.indexOf(c) < 0) {
        colliders.push(c);
        lowestY = Math.min(lowestY, c.min.y);
      }
    }

    districts.push({
      def: d,
      center: new THREE.Vector3(cx, 0, cz),
      stallMesh: sm,
      group: dGroup,
      colliders: dCols,
    });
    streamChunks.push({
      id: `district_${d.id}`,
      x: cx,
      z: cz,
      group: dGroup,
      colliders: dCols,
      // Keep home district + industrial HQ always resident for spawn/workshop
      resident: d.id === 'residential' || d.id === 'industrial',
    });
    impostorGroup.add(makeIslandImpostor(cx, cz, sz, d.color));

    // Rogue warning beacon — high above plaza, always-resident (not on streamed dGroup)
    {
      const root = new THREE.Group();
      root.name = `RogueBeacon_${d.id}`;
      root.visible = false;
      root.position.set(cx, 0, cz);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, ROGUE_BEACON_Y - 2, 6),
        mats.ironDark,
      );
      mast.position.y = (ROGUE_BEACON_Y - 2) / 2 + 1;
      root.add(mast);

      const bulbMat = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        fog: false,
        transparent: true,
        opacity: 0.95,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 12), bulbMat);
      bulb.position.y = ROGUE_BEACON_Y;
      bulb.renderOrder = 4;
      root.add(bulb);

      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        fog: false,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 12), haloMat);
      halo.position.y = ROGUE_BEACON_Y;
      halo.renderOrder = 3;
      root.add(halo);

      // Tall additive shaft so the warning reads as a skyward column from afar
      const shaftMat = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        fog: false,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.7, 20, 8), shaftMat);
      shaft.position.y = ROGUE_BEACON_Y - 10;
      shaft.renderOrder = 2;
      root.add(shaft);

      rogueBeaconGroup.add(root);
      rogueBeacons.push({
        districtId: d.id,
        root,
        bulbMat,
        haloMat,
        shaftMat,
        lit: false,
      });
    }
  }

  // Reset sinks for hub / root content
  meshSink = (m) => hubGroup.add(m);
  colSink = (c) => {
    hubCols.push(c);
    colliders.push(c);
    lowestY = Math.min(lowestY, c.min.y);
  };

  // ——— Wind skyways only between islands (no solid roads) ———
  const skywayPairs: [string, string][] = [
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
  for (const [a, b] of skywayPairs) {
    const da = byId(a);
    const db = byId(b);
    const dist = Math.hypot(da.x - db.x, da.z - db.z);
    windSkyway(da.x, da.z, db.x, db.z, {
      arch: Math.min(22, 6 + dist * 0.035),
      width: 8,
    });
  }

  // ——— Apartment at residential ———
  const apartmentGroup = new THREE.Group();
  apartmentGroup.name = 'PlayerApartment';
  hubGroup.add(apartmentGroup);
  {
    // Visual underlay only — walkable deck + walls come from syncHomeVisuals
    // (player_home chunk). A fixed pad collider here went stale on expand/relocate.
    const home = floorPad(mats, 22, 18, apartmentPos.x, DECK_Y, apartmentPos.z, 0x6a5f50);
    addMesh(home.mesh);
    // Same residential island cluster — short wind hop to plaza center
    windSkyway(apartmentPos.x, apartmentPos.z, residential.x, residential.z, {
      arch: 4,
      width: 6.5,
      entryLift: 0.7,
    });
    placeScenery(hubGroup, mats, 'tree', 0, apartmentPos.x + 10, apartmentPos.z + 7, 0.4, 0.95);
    const homeLab = labelSprite('YOUR HOME');
    homeLab.position.set(apartmentPos.x, 5.2, apartmentPos.z + 2);
    addMesh(homeLab);
    // Manage / improve interact — visuals filled by syncHomeVisuals
    const mark = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xe8c878,
        emissive: 0xaa8800,
        emissiveIntensity: 0.55,
      }),
    );
    mark.position.set(apartmentPos.x + 2, 1.25, apartmentPos.z + 6);
    apartmentGroup.add(mark);
    interactables.push({
      id: 'player_home',
      kind: 'player_home',
      position: mark.position.clone(),
      radius: 3.2,
      mesh: mark,
      label: 'Your home · improve / expand',
    });
  }

  // Neighbors on residential ring
  const neighborSpots = [
    {
      x: residential.x + 26,
      z: residential.z + 22,
      name: 'Pip Harper',
      lines: [
        'Empire city! Lease stalls on many plazas — Spore Gardens & Aether Spire pay invent premiums.',
        'Expand your bay forever. Raise worker pay for long program lists. Multi-shop cash flow is the game.',
        'No roads between islands — only wind skyways. Q board and ride the cyan lanes.',
      ],
    },
    {
      x: residential.x - 24,
      z: residential.z - 24,
      name: 'Sera Quinn',
      lines: [
        'One board purchase forever. Q anywhere. Islands only connect by wind skyways — ride them.',
        'Invent at the city workshop or L3 bay, craft, stock premium plazas — that’s the market cycle.',
      ],
    },
    {
      x: residential.x + 28,
      z: residential.z - 18,
      name: 'Bolt Voss',
      lines: [
        'Industrial slips west. Hire a crew, raise pay grades, run harvest→craft→stock programs.',
        'Shops tax upkeep — earn more than you burn with a retail network.',
      ],
    },
  ];
  for (const n of neighborSpots) {
    const pad = floorPad(mats, 14, 12, n.x, DECK_Y, n.z, 0x555048);
    addMesh(pad.mesh);
    addCol(pad.col);
    windSkyway(n.x, n.z, residential.x, residential.z, { arch: 5, width: 6, entryLift: 0.7 });
    const house = solidBox(mats, mats.wood, 5, 3.2, 5, n.x, 2.0, n.z);
    addMesh(house.mesh);
    addCol(house.col);
    placeScenery(hubGroup, mats, 'tree', 0, n.x - 4, n.z + 3, 0.4, 0.95);
    const mark = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe8c878,
        emissive: 0xaa8800,
        emissiveIntensity: 0.45,
      }),
    );
    mark.position.set(n.x + 3, 1.2, n.z);
    addMesh(mark);
    const lab = labelSprite(`NEIGHBOR · ${n.name}`);
    lab.position.set(n.x, 3.8, n.z + 2);
    addMesh(lab);
    interactables.push({
      id: `neighbor_${n.name}`,
      kind: 'neighbor',
      position: mark.position.clone(),
      radius: 2.4,
      mesh: mark,
      label: `Talk to ${n.name}`,
      lines: n.lines,
    });
  }

  // Board shop on residential
  {
    const rack = solidBox(mats, mats.iron, 2.5, 1.2, 0.5, residential.x + 14, 1.0, residential.z - 12);
    addMesh(rack.mesh);
    const bm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x66e0ff,
        emissive: 0x2288cc,
        emissiveIntensity: 0.5,
      }),
    );
    bm.position.set(residential.x + 14, 1.2, residential.z - 10);
    addMesh(bm);
    const bl = labelSprite('CITY BOARD SHOP');
    bl.position.set(residential.x + 14, 2.8, residential.z - 12);
    addMesh(bl);
    interactables.push({
      id: 'city_board',
      kind: 'board_shop',
      position: bm.position.clone(),
      radius: 2.5,
      mesh: bm,
      label: 'Board shop — buy once, ride forever',
    });
  }

  // Ferry
  {
    const pad = floorPad(mats, 12, 10, residential.x, DECK_Y, residential.z + 36, 0x4a5060);
    addMesh(pad.mesh);
    addCol(pad.col);
    windSkyway(residential.x, residential.z, residential.x, residential.z + 36, { arch: 5, width: 6.5, entryLift: 0.7 });
    const fm = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0x4488aa,
        emissiveIntensity: 0.5,
      }),
    );
    fm.position.set(residential.x, 1.2, residential.z + 38);
    addMesh(fm);
    const fl = labelSprite('FERRY · training market');
    fl.position.set(residential.x, 2.8, residential.z + 38);
    addMesh(fl);
    interactables.push({
      id: 'ferry',
      kind: 'ferry_training',
      position: fm.position.clone(),
      radius: 2.6,
      mesh: fm,
      label: 'Ferry back to Market Training',
    });
  }

  // ——— Full industrial workshop complex (empire HQ) ———
  {
    const indRec = districtBag.get('industrial')!;
    meshSink = (m) => indRec.group.add(m);
    colSink = (c) => {
      indRec.cols.push(c);
      colliders.push(c);
      lowestY = Math.min(lowestY, c.min.y);
    };
    const ix = industrialDef.x;
    const iz = industrialDef.z;
    // Lease marker (always)
    const lm = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x82e0aa,
        emissive: 0x228844,
        emissiveIntensity: 0.5,
      }),
    );
    lm.position.set(ix + 18, 1.3, iz + 10);
    addMesh(lm);
    const ll = labelSprite('LEASE CITY WORKSHOP · empire HQ');
    ll.position.set(ix + 18, 3, iz + 10);
    setSignWorldWidth(ll, 4.2);
    addMesh(ll);
    interactables.push({
      id: 'city_workshop_lease',
      kind: 'workshop_lease',
      position: lm.position.clone(),
      radius: 2.6,
      mesh: lm,
      label: 'Lease city workshop (craft · hire · invent · expand forever)',
    });

    // Interior props — shown when leased
    const floorMark = solidBox(mats, mats.iron, 22, 0.2, 18, ix - 2, 0.45, iz);
    workshopGroup.add(floorMark.mesh);
    const bench = solidBox(mats, mats.iron, 4, 1, 2, ix - 8, 0.95, iz + 3);
    workshopGroup.add(bench.mesh);
    const anvil = solidBox(mats, mats.brass, 1.2, 0.8, 1.2, ix - 8, 0.85, iz + 0.5);
    workshopGroup.add(anvil.mesh);
    const chest = solidBox(mats, mats.wood, 1.5, 1, 1.2, ix + 2, 0.95, iz - 5);
    workshopGroup.add(chest.mesh);
    const hirePost = solidBox(mats, mats.copper, 0.4, 2.2, 0.4, ix + 6, 1.5, iz + 4);
    workshopGroup.add(hirePost.mesh);
    const inventTable = solidBox(mats, mats.wood, 2.5, 0.9, 1.4, ix - 2, 0.9, iz - 5);
    workshopGroup.add(inventTable.mesh);
    // Expand wings (visual only — always in group; scale with bay via game if needed)
    const wingL2 = solidBox(mats, mats.iron, 8, 3, 6, ix - 14, 1.8, iz - 2);
    wingL2.mesh.name = 'cityWingL2';
    workshopGroup.add(wingL2.mesh);
    const wingL3 = solidBox(mats, mats.copper, 10, 4, 8, ix + 10, 2.2, iz - 6);
    wingL3.mesh.name = 'cityWingL3';
    workshopGroup.add(wingL3.mesh);
    indRec.group.add(workshopGroup);

    const addMark = (
      id: string,
      kind: CityInteractKind,
      x: number,
      z: number,
      color: number,
      emissive: number,
      label: string,
      y = 1.25,
    ) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.5,
        }),
      );
      m.position.set(x, y, z);
      workshopGroup.add(m);
      const lab = labelSprite(label.split('·')[0]!.trim());
      lab.position.set(x, y + 1.5, z);
      workshopGroup.add(lab);
      interactables.push({
        id,
        kind,
        position: m.position.clone(),
        radius: 2.5,
        mesh: m,
        label,
      });
    };

    addMark(
      'city_workshop_chest',
      'workshop_chest',
      ix + 2,
      iz - 5,
      0xffd700,
      0xaa8800,
      'Bay office · I inventory · workers · invent',
    );
    addMark(
      'city_craft',
      'craft_bench',
      ix - 8,
      iz + 3,
      0xff8866,
      0xaa4422,
      'Workbench · craft & assemble',
    );
    addMark(
      'city_hire',
      'hire_board',
      ix + 6,
      iz + 4,
      0x66e0aa,
      0x228844,
      'Hire board · crew & worker upgrades',
    );
    // Expand is on Sky Foundry (separate island) — pointer only
    {
      const tip = labelSprite('EXPAND YARDS → Sky Foundry (board west)');
      tip.position.set(ix - 12, 2.8, iz - 4);
      setSignWorldWidth(tip, 5.2);
      workshopGroup.add(tip);
    }
    addMark(
      'city_invent',
      'invent_desk',
      ix - 2,
      iz - 5,
      0xdda0ff,
      0x6622aa,
      'Invent desk · market-cycle recipes',
    );
    addMark(
      'city_repair_post',
      'repair_job',
      ix + 10,
      iz + 2,
      0xffaa66,
      0xcc6622,
      'Repair post · spend kit for brass',
    );
  }

  // ——— Empire expand yards (Sky Foundry — NOT home or workshop) ———
  // Board west from Industrial Slips along the wind skyway.
  const expandYardGroup = new THREE.Group();
  expandYardGroup.name = 'ExpandYard';
  expandYardGroup.visible = false;
  {
    const foundryRec = districtBag.get('sky_foundry')!;
    meshSink = (m) => foundryRec.group.add(m);
    colSink = (c) => {
      foundryRec.cols.push(c);
      colliders.push(c);
      lowestY = Math.min(lowestY, c.min.y);
    };
    const fd = byId('sky_foundry');
    const fx = fd.x;
    const fz = fd.z;
    // Yard apron (extra walkable deck on foundry island)
    const apron = floorPad(mats, 36, 28, fx + 8, DECK_Y, fz - 6, 0x3a3834);
    expandYardGroup.add(apron.mesh);
    addCol(apron.col);
    const office = solidBox(mats, mats.iron, 10, 4, 8, fx + 14, 2.2, fz - 14);
    expandYardGroup.add(office.mesh);
    addCol(office.col);
    const stack = solidBox(mats, mats.copper, 3, 8, 3, fx + 20, 4.2, fz - 10);
    expandYardGroup.add(stack.mesh);
    addCol(stack.col);
    const crane = solidBox(mats, mats.brass, 14, 0.6, 1.2, fx + 4, 6.5, fz - 4);
    expandYardGroup.add(crane.mesh);

    // Progressive bay wings — shown by game via name + bayLevel
    const wingDefs: {
      name: string;
      minLevel: number;
      w: number;
      h: number;
      d: number;
      ox: number;
      oy: number;
      oz: number;
      mat: THREE.Material;
    }[] = [
      { name: 'expandWingL2', minLevel: 2, w: 10, h: 2.5, d: 8, ox: -6, oy: 1.5, oz: 4, mat: mats.iron },
      { name: 'expandWingL3', minLevel: 3, w: 12, h: 3.2, d: 10, ox: 2, oy: 1.9, oz: 8, mat: mats.copper },
      { name: 'expandWingL4', minLevel: 4, w: 14, h: 3.6, d: 11, ox: -10, oy: 2.1, oz: -2, mat: mats.brass },
      { name: 'expandWingL5', minLevel: 5, w: 16, h: 4, d: 12, ox: 12, oy: 2.4, oz: 2, mat: mats.iron },
      { name: 'expandWingL6', minLevel: 6, w: 18, h: 4.5, d: 14, ox: -4, oy: 2.6, oz: -12, mat: mats.copper },
    ];
    for (const w of wingDefs) {
      const box = solidBox(mats, w.mat, w.w, w.h, w.d, fx + w.ox, w.oy, fz + w.oz);
      box.mesh.name = w.name;
      box.mesh.userData.expandMinLevel = w.minLevel;
      box.mesh.visible = false;
      expandYardGroup.add(box.mesh);
    }

    // Expand kiosk (pay brass → raise bayLevel / crew cap)
    const kiosk = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        emissive: 0x4466cc,
        emissiveIntensity: 0.65,
      }),
    );
    kiosk.position.set(fx + 6, 1.4, fz - 2);
    expandYardGroup.add(kiosk);
    const kLab = labelSprite('EXPAND BAY · more crew slots · no hard cap');
    kLab.position.set(fx + 6, 3.2, fz - 2);
    setSignWorldWidth(kLab, 5.4);
    expandYardGroup.add(kLab);
    const title = labelSprite('EMPIRE EXPAND YARDS · Sky Foundry');
    title.position.set(fx + 8, 5.5, fz - 16);
    setSignWorldWidth(title, 5.5);
    expandYardGroup.add(title);

    interactables.push({
      id: 'city_expand',
      kind: 'bay_expand',
      position: kiosk.position.clone(),
      radius: 2.8,
      mesh: kiosk,
      label: 'Expand bay · Empire yards · more worker slots (unlimited)',
      districtId: 'sky_foundry',
    });

    foundryRec.group.add(expandYardGroup);
  }

  // Ambient extras + NPCs live on root (always drawn; LOD in animate)
  meshSink = (m) => group.add(m);
  colSink = (c) => {
    colliders.push(c);
    lowestY = Math.min(lowestY, c.min.y);
  };

  // Bonded storage offices — one track per distant plaza (no dedicated HQs)
  {
    const placeStorage = (
      districtId: string,
      track: 'resources' | 'crafted' | 'inventions',
      title: string,
      blurb: string,
      color: number,
      emissive: number,
      ox: number,
      oz: number,
    ) => {
      const d = byId(districtId);
      const x = d.x + ox;
      const z = d.z + oz;
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.35, 7),
        new THREE.MeshStandardMaterial({ color: 0x3a3834, roughness: 0.75 }),
      );
      pad.position.set(x, DECK_Y + 0.2, z);
      addMesh(pad);
      addCol({
        min: new THREE.Vector3(x - 3.6, DECK_Y - 0.2, z - 3.6),
        max: new THREE.Vector3(x + 3.6, DECK_Y + 0.55, z + 3.6),
        kind: 'floor',
      });
      const booth = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.4, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.65, metalness: 0.35 }),
      );
      booth.position.set(x, DECK_Y + 1.4, z);
      addMesh(booth);
      const mark = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.55,
        }),
      );
      mark.position.set(x + 2.2, DECK_Y + 1.15, z);
      addMesh(mark);
      const lab = labelSprite(title);
      lab.position.set(x, DECK_Y + 3.2, z);
      setSignWorldWidth(lab, 4.2);
      addMesh(lab);
      const sub = labelSprite(blurb);
      const subLines = typeof sub.userData.signLines === 'number' ? sub.userData.signLines : 1;
      sub.position.set(x, DECK_Y + 2.55 - Math.max(0, subLines - 1) * 0.22, z);
      setSignWorldWidth(sub, 3.6);
      addMesh(sub);
      interactables.push({
        id: `storage_${track}`,
        kind: 'storage_office',
        position: mark.position.clone(),
        radius: 2.6,
        mesh: mark,
        label: `${title} · ${blurb}`,
        districtId,
        storageTrack: track,
      });
    };

    placeStorage(
      'north_observatory',
      'resources',
      'BONDED RESOURCES',
      'Expand raw mat stacks',
      0xe8c878,
      0xaa8844,
      14,
      -10,
    );
    placeStorage(
      'clocktower',
      'crafted',
      'BONDED CRAFT VAULT',
      'Expand kits · frames · tools',
      0x7ec8e8,
      0x2a6a88,
      -12,
      14,
    );
    placeStorage(
      'aether_spire',
      'inventions',
      'INVENTION VAULT',
      'Expand invention stock',
      0xdda0ff,
      0x6622aa,
      12,
      12,
    );
  }

  // Extra wander pads for density (same deck height) — streamed individually
  const extraPads: [number, number, number, number][] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 180 + (i % 5) * 55;
    extraPads.push([
      Math.cos(a) * r + (i % 3) * 20,
      Math.sin(a) * r + ((i * 7) % 5) * 15,
      14 + (i % 4) * 2,
      12 + (i % 3) * 2,
    ]);
  }
  for (let i = 0; i < extraPads.length; i++) {
    const [x, z, w, d] = extraPads[i]!;
    const eg = new THREE.Group();
    eg.name = `ExtraPad_${i}`;
    group.add(eg);
    const p = floorPad(mats, w, d, x, DECK_Y, z, 0x4a4844);
    eg.add(p.mesh);
    const eCols: Collider[] = [p.col];
    colliders.push(p.col);
    lowestY = Math.min(lowestY, p.col.min.y);
    if (i % 2 === 0) {
      placeScenery(eg, mats, 'tree', i % 5, x + 2, z - 1, 0.4, 0.9);
    }
    if (i % 3 === 0) {
      placeScenery(eg, mats, 'building', i % 5, x - 1, z + 2, 0.4, 0.7, i * 0.3, eCols, true);
      for (const c of eCols) {
        if (colliders.indexOf(c) < 0) {
          colliders.push(c);
          lowestY = Math.min(lowestY, c.min.y);
        }
      }
    }
    streamChunks.push({
      id: `extra_${i}`,
      x,
      z,
      group: eg,
      colliders: eCols,
    });
  }

  // Link scattered islands with wind skyways (no roads)
  for (let i = 0; i < extraPads.length; i += 3) {
    const [x, z] = extraPads[i]!;
    let best = CITY_DISTRICTS[0]!;
    let bestD = Infinity;
    for (const d of CITY_DISTRICTS) {
      const dd = Math.hypot(d.x - x, d.z - z);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    if (bestD > 30 && bestD < 220) {
      windSkyway(best.x, best.z, x, z, { arch: 8 + bestD * 0.02, width: 6.5 });
    }
  }

  // Ambient NPCs — dense lived-in city (each walker stays on one plaza)
  const DECK_STAND_NPC = plazaDeckStandY(DECK_Y);
  // Residents + flyers
  for (let i = 0; i < 48; i++) {
    const homeD = CITY_DISTRICTS[i % CITY_DISTRICTS.length]!;
    const home = plazaPoint(homeD, 0.4);
    // Walkers patrol only on their home plaza; flyers may leave via skyways
    const flyer = i % 4 === 0;
    const workD = flyer
      ? CITY_DISTRICTS.filter((d) => d.role === 'industrial' || d.role === 'market')[
          i % Math.max(1, CITY_DISTRICTS.filter((d) => d.role === 'industrial' || d.role === 'market').length)
        ] ?? homeD
      : homeD;
    const marketD = flyer
      ? CITY_DISTRICTS.filter(
          (d) => d.role === 'market' || d.role === 'premium' || d.role === 'mixed',
        )[
          i %
            Math.max(
              1,
              CITY_DISTRICTS.filter(
                (d) => d.role === 'market' || d.role === 'premium' || d.role === 'mixed',
              ).length,
            )
        ] ?? homeD
      : homeD;
    const work = flyer ? plazaPoint(workD, 0.35) : plazaPoint(homeD, 0.38);
    const market = flyer ? plazaPoint(marketD, 0.35) : plazaPoint(homeD, 0.36);
    const parts = makeNpcMesh(flyer ? 'flyer' : 'resident', mats, false, i);
    parts.root.position.copy(home);
    if (flyer) parts.root.position.y = DECK_Y + 4.5 + Math.random() * 2;
    addMesh(parts.root);
    const homeInterior = home.clone();
    homeInterior.y = 1.6;
    const route =
      flyer && (workD.id !== homeD.id || marketD.id !== homeD.id)
        ? pickSkyRoute(skyRoutes, home, work.distanceTo(home) > market.distanceTo(home) ? work : market)
        : null;
    npcs.push({
      mesh: parts.root,
      parts,
      home,
      work,
      market,
      role: flyer ? 'flyer' : 'resident',
      visual: flyer ? 'flyer' : 'resident',
      phase: Math.random(),
      speed: flyer ? 9 + Math.random() * 5 : 2.4 + Math.random() * 1.8,
      homeInterior,
      plazaCx: homeD.x,
      plazaCz: homeD.z,
      plazaRadius: homeD.size,
      deckY: DECK_STAND_NPC,
      homeDistrictId: homeD.id,
      skyRoute: route,
      routeIndex: route ? 0 : undefined,
    });
  }

  // Romance-eligible girl NPCs (named) — stay on their plaza
  const girlNames = [
    { id: 'girl_lira', name: 'Lira Voss', lines: ['Oh— a maker? Careful, I might steal your afternoon.', 'Bring me blooms from the gardens… or charm me better.'] },
    { id: 'girl_mira', name: 'Mira Quinn', lines: ['Your board looks fast. Are you?', 'Silk and secrets — gift me either.'] },
    { id: 'girl_nova', name: 'Nova Hale', lines: ['Don’t just harvest the reefs… notice me.', 'A brass charm would suit my wrist.'] },
    { id: 'girl_sage', name: 'Sage Wren', lines: ['Empire boys always rush. Slow down.', 'Spore-silk scarf? Now you’re talking.'] },
  ];
  for (let i = 0; i < girlNames.length; i++) {
    const gdef = girlNames[i]!;
    const d = CITY_DISTRICTS[(i * 3 + 1) % CITY_DISTRICTS.length]!;
    const home = plazaPoint(d, 0.32);
    const parts = makeNpcMesh('girl', mats, false, i + 3);
    parts.root.position.copy(home);
    addMesh(parts.root);
    const mark = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff88aa,
        emissive: 0xaa3366,
        emissiveIntensity: 0.5,
      }),
    );
    mark.position.set(home.x + 1.2, 1.2, home.z);
    addMesh(mark);
    interactables.push({
      id: gdef.id,
      kind: 'romance_npc',
      position: mark.position.clone(),
      radius: 2.5,
      mesh: mark,
      label: `Talk · ${gdef.name}`,
      lines: gdef.lines,
      districtId: d.id,
    });
    npcs.push({
      id: gdef.id,
      displayName: gdef.name,
      mesh: parts.root,
      parts,
      home,
      work: plazaPoint(d, 0.34),
      market: plazaPoint(d, 0.3),
      role: 'girl',
      visual: 'girl',
      phase: Math.random(),
      speed: 2.6,
      romance: true,
      giftLines: gdef.lines,
      homeInterior: new THREE.Vector3(home.x, 1.6, home.z - 1),
      plazaCx: d.x,
      plazaCz: d.z,
      plazaRadius: d.size,
      deckY: DECK_STAND_NPC,
      homeDistrictId: d.id,
    });
  }

  // Owned work robots — every chassis has an owner + job; none spawn as dedicated rogues
  const DECK_STAND = DECK_STAND_NPC;
  for (let i = 0; i < 22; i++) {
    const d = CITY_DISTRICTS[i % CITY_DISTRICTS.length]!;
    const jobId = pickCityRobotJob(d.role, i);
    const ownerName = NPC_ROBOT_OWNERS[i % NPC_ROBOT_OWNERS.length]!;
    const spawn = plazaPoint(d, 0.4);
    spawn.y = DECK_STAND;
    const work = plazaPoint(d, 0.36);
    work.y = DECK_STAND;
    const market = plazaPoint(d, 0.34);
    market.y = DECK_STAND;
    const robot = new RobotUnit(mats, spawn.clone());
    const frameName = `Frame-${i + 1}`;
    robot.displayName = frameName;
    robot.setPhase('ally');
    robot.onGround = true;
    robot.vy = 0;
    addMesh(robot.mesh);
    const botId = `citybot_${i}`;
    const mark = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x66cc88,
        emissive: 0x228844,
        emissiveIntensity: 0.55,
      }),
    );
    mark.position.set(spawn.x, DECK_STAND + 1.25, spawn.z + 1.15);
    mark.visible = false;
    addMesh(mark);
    interactables.push({
      id: botId,
      kind: 'city_robot',
      position: mark.position.clone(),
      radius: 2.6,
      mesh: mark,
      label: `${frameName} · ${jobLabel(jobId)} · ${ownerName}`,
    });
    npcs.push({
      mesh: robot.mesh,
      robot,
      home: spawn.clone(),
      work,
      market,
      role: 'robot_helper',
      visual: 'robot_helper',
      phase: Math.random(),
      speed: 2.35 + Math.random() * 0.6,
      rogue: false,
      plazaCx: d.x,
      plazaCz: d.z,
      plazaRadius: d.size,
      deckY: DECK_STAND,
      homeDistrictId: d.id,
      id: botId,
      displayName: frameName,
      owner: { kind: 'npc', id: `npc_owner_${i % NPC_ROBOT_OWNERS.length}`, name: ownerName },
      jobId,
      // Brief immunity so the city doesn't open with instant rogue rolls
      rogueImmuneT: 60 + Math.random() * 120,
    });
  }

  // Broker frame display props (updated live from game)
  for (const d of CITY_DISTRICTS.filter((x) => x.role === 'industrial' || x.id === 'grand_market')) {
    const disp = new THREE.Group();
    disp.name = `BrokerStock_${d.id}`;
    disp.position.set(d.x + d.size * 0.28, 0.9, d.z - d.size * 0.22);
    group.add(disp);
    brokerDisplays[d.id] = disp;
    const buyMark = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x88e0ff,
        emissive: 0x2266aa,
        emissiveIntensity: 0.5,
      }),
    );
    buyMark.position.set(d.x + d.size * 0.32, 1.3, d.z - d.size * 0.18);
    addMesh(buyMark);
    interactables.push({
      id: `buy_robot_${d.id}`,
      kind: 'buy_robot',
      position: buyMark.position.clone(),
      radius: 2.5,
      mesh: buyMark,
      label: 'Buy work robot · 120b (assembled frame or broker)',
      districtId: d.id,
    });
  }

  // Sky routes already built by windSkyway()
  {
    const skyLab = labelSprite('SKYWAYS · Q board · wind paths only · no roads');
    skyLab.position.set(apartmentPos.x + 8, 5.5, apartmentPos.z);
    setSignWorldWidth(skyLab, 5.5);
    addMesh(skyLab);
  }


  const apartmentSpawn = new THREE.Vector3(apartmentPos.x + 4, 1.75, apartmentPos.z);
  const harvestSpot = new THREE.Vector3(byId('harbor').x - 30, 0.5, byId('harbor').z);

  // Resident stream chunks
  streamChunks.push({
    id: 'skyways',
    x: residential.x,
    z: residential.z,
    group: skywayGroup,
    colliders: skywayCols,
    resident: true,
  });
  streamChunks.push({
    id: 'hub_residential',
    x: apartmentPos.x,
    z: apartmentPos.z,
    group: hubGroup,
    colliders: hubCols,
    resident: true,
  });
  // Impostors always visible (cheap distant islands)
  streamChunks.push({
    id: 'impostors',
    x: 0,
    z: 0,
    group: impostorGroup,
    colliders: [],
    resident: true,
  });
  streamChunks.push({
    id: 'rogue_beacons',
    x: 0,
    z: 0,
    group: rogueBeaconGroup,
    colliders: [],
    resident: true,
  });

  const animState = { npcActive: 0 };

  const setLodFocus = (x: number, z: number) => {
    lodFocusX = x;
    lodFocusZ = z;
  };

  const setPlazaRogueBeacons = (activeDistrictIds: Iterable<string>) => {
    const lit = activeDistrictIds instanceof Set
      ? activeDistrictIds
      : new Set(activeDistrictIds);
    for (const b of rogueBeacons) {
      const on = lit.has(b.districtId);
      b.lit = on;
      b.root.visible = on;
      if (!on) {
        b.bulbMat.opacity = 0.95;
        b.haloMat.opacity = 0.4;
        b.shaftMat.opacity = 0.28;
      }
    }
  };

  const animate = (cityTime: number, dt: number) => {
    // Skyway distance LOD — hide far ribbon groups
    for (const s of skywayLods) {
      const d = Math.hypot(s.x - lodFocusX, s.z - lodFocusZ);
      s.root.visible = d < 320;
    }

    // Pulse lit rogue warning beacons (red skyward signal)
    const animT = cityTime * 48;
    for (const b of rogueBeacons) {
      if (!b.lit) continue;
      const pulse = 0.5 + 0.5 * Math.sin(animT * 2.4 + b.root.position.x * 0.01);
      b.bulbMat.opacity = 0.55 + 0.45 * pulse;
      b.haloMat.opacity = 0.18 + 0.5 * pulse;
      b.shaftMat.opacity = 0.14 + 0.32 * pulse;
      const s = 0.92 + 0.14 * pulse;
      b.root.scale.set(s, 1 + 0.06 * pulse, s);
    }

    let active = 0;
    for (const n of npcs) {
      const nx = n.mesh.position.x;
      const nz = n.mesh.position.z;
      const dist = Math.hypot(nx - lodFocusX, nz - lodFocusZ);
      if (dist > 220) {
        n.mesh.visible = false;
        continue;
      }
      n.mesh.visible = true;
      // Mid range: update at ~12 Hz
      if (dist > 90) {
        n.lodAcc = (n.lodAcc ?? 0) + dt;
        if (n.lodAcc < 1 / 12) continue;
        n.lodAcc = 0;
      }
      active++;

      // All city robots: motion/combat driven by game.ts (deck-locked wander)
      if (n.robot) {
        continue;
      }

      if (!n.parts) continue;
      let target: THREE.Vector3;
      const t = (cityTime + n.phase * 0.15) % 1;
      const atHomePhase = t < 0.2 || t >= 0.7;
      if (t < 0.2) target = n.home;
      else if (t < 0.45) target = n.work;
      else if (t < 0.7) target = n.market;
      else target = n.home;

      let moving = false;
      if (n.role === 'flyer') {
        const pos = n.mesh.position;
        const destDist = Math.hypot(target.x - pos.x, target.z - pos.z);
        // Cross-island: follow skyway at route height
        const needsRoute = destDist > n.plazaRadius * 0.55;
        if (needsRoute) {
          if (!n.skyRoute || (n.routeIndex ?? 0) >= (n.skyRoute.path.length - 1)) {
            n.skyRoute = pickSkyRoute(skyRoutes, pos, target);
            n.routeIndex = n.skyRoute ? nearestRouteIndex(n.skyRoute.path, pos) : 0;
          }
          const route = n.skyRoute;
          if (route && route.path.length > 1) {
            let idx = n.routeIndex ?? 0;
            // Orient toward the end closer to target
            const endA = route.path[0]!;
            const endB = route.path[route.path.length - 1]!;
            const goForward = endB.distanceToSquared(target) <= endA.distanceToSquared(target);
            const nextIdx = goForward
              ? Math.min(route.path.length - 1, idx + 1)
              : Math.max(0, idx - 1);
            const nxt = route.path[nextIdx]!;
            scratchDest.copy(nxt);
            // Ride slightly above the wind path
            scratchDest.y = nxt.y + 1.1;
            scratchDir.copy(scratchDest).sub(pos);
            const dlen = scratchDir.length();
            if (dlen > 0.35) {
              scratchDir.multiplyScalar(1 / dlen);
              pos.addScaledVector(scratchDir, Math.min(n.speed * dt, dlen));
              n.mesh.rotation.y = Math.atan2(scratchDir.x, scratchDir.z);
              moving = true;
            }
            if (pos.distanceTo(scratchDest) < 1.2) {
              n.routeIndex = nextIdx;
            }
            // Arrived near destination plaza — drop local
            if (Math.hypot(target.x - pos.x, target.z - pos.z) < n.plazaRadius * 0.35) {
              n.skyRoute = null;
            }
          } else {
            scratchDest.set(target.x, DECK_Y + 5 + Math.sin(animT + n.phase) * 1.2, target.z);
            scratchDir.copy(scratchDest).sub(pos);
            const dlen = scratchDir.length();
            if (dlen > 0.5) {
              scratchDir.multiplyScalar(1 / dlen);
              pos.addScaledVector(scratchDir, Math.min(n.speed * dt, dlen));
              n.mesh.rotation.y = Math.atan2(scratchDir.x, scratchDir.z);
              moving = true;
            }
          }
        } else {
          n.skyRoute = null;
          scratchDest.set(
            target.x,
            DECK_Y + 4.2 + Math.sin(cityTime * Math.PI * 2 + n.phase) * 1.4,
            target.z,
          );
          scratchDir.copy(scratchDest).sub(pos);
          const dlen = scratchDir.length();
          if (dlen > 0.45) {
            scratchDir.multiplyScalar(1 / dlen);
            pos.addScaledVector(scratchDir, Math.min(n.speed * dt, dlen));
            n.mesh.rotation.y = Math.atan2(scratchDir.x, scratchDir.z);
            moving = true;
          }
        }
        n.insideHome = false;
      } else {
        const pos = n.mesh.position;
        // Visit interior when home phase and close
        if (atHomePhase && n.homeInterior && Math.hypot(pos.x - n.home.x, pos.z - n.home.z) < 2.5) {
          n.insideHome = true;
          pos.x = n.homeInterior.x;
          pos.z = n.homeInterior.z;
          pos.y = 0;
          n.mesh.visible = dist < 40;
        } else {
          n.insideHome = false;
          const dx = target.x - pos.x;
          const dz = target.z - pos.z;
          const dlen = Math.hypot(dx, dz);
          if (dlen > 0.35) {
            const step = Math.min(n.speed * dt, dlen);
            pos.x += (dx / dlen) * step;
            pos.z += (dz / dlen) * step;
            n.mesh.rotation.y = Math.atan2(dx, dz);
            moving = true;
          }
          clampToPlaza(pos, n.plazaCx, n.plazaCz, n.plazaRadius, n.deckY ?? 0);
        }
      }
      tickNpcAnim(n.parts, n.visual, animT, moving, n.phase);
    }
    animState.npcActive = active;
  };

  const built: SkyCityBuilt = {
    group,
    colliders,
    mats,
    apartmentSpawn,
    apartmentGroup,
    apartmentAnchor: apartmentPos.clone(),
    interactables,
    npcs,
    skyRoutes,
    workshopGroup,
    expandYardGroup,
    stallGroup,
    districtStallGroups,
    factoryGroups,
    districts,
    rogueBeacons,
    setPlazaRogueBeacons,
    streamChunks,
    harvestSpot,
    residentialPlaza,
    grandMarket,
    industrial,
    mapSnapshot: null as unknown as MapSnapshot,
    setLodFocus,
    animate,
    get lastNpcActive() {
      return animState.npcActive;
    },
    set lastNpcActive(v: number) {
      animState.npcActive = v;
    },
    lowestY: lowestY - 2,
    circuits,
    brokerDisplays,
  };
  built.mapSnapshot = buildMapSnapshot(built);
  return built;
}

/** Sync visual frame props at brokers from inventory stock. */
export function syncBrokerFrameDisplays(city: SkyCityBuilt, stock: number) {
  const geo = new THREE.BoxGeometry(0.45, 0.7, 0.35);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.55,
    roughness: 0.4,
    emissive: 0x223344,
    emissiveIntensity: 0.3,
  });
  for (const disp of Object.values(city.brokerDisplays)) {
    while (disp.children.length) disp.remove(disp.children[0]!);
    const n = Math.min(12, Math.max(0, stock));
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set((i % 4) * 0.55 - 0.8, Math.floor(i / 4) * 0.75, 0);
      disp.add(m);
    }
  }
}
