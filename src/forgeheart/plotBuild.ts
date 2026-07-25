/**
 * Plot build mode — site-builder style placement for plaza plots.
 * Dual ghosts: translucent “current” placement + clearer “preview” placement
 * (same idea as stall/home selection box + door direction).
 */

import * as THREE from 'three';
import type { PlotBuildKind, PlotBuildingStub, PlotState } from './plazaPlots';
import { PLOT_BUILD_CATALOG, hasAdjacentOwned, BRIDGE_WIDTH_MUL } from './plazaPlots';
import type { CityDistrictDef } from './economy';
import { makeSignSprite, setSignWorldWidth } from './signLabel';
import type { Collider } from './level';
import type { RaceRail } from './raceway';

export type PlotBuildModeStep = 'choose' | 'place' | 'transform';

export type PlotTransformTool = 'rotate' | 'move';

export interface PlotBuildSession {
  plotId: string;
  districtId: string;
  cellX: number;
  cellY: number;
  /** Live platform center (free world) */
  centerX: number;
  centerZ: number;
  cellSize: number;
  step: PlotBuildModeStep;
  /** Selected catalog kind when building */
  buildKind: PlotBuildKind | null;
  /** Transform mode */
  transform: PlotTransformTool | null;
  /** Preview rotation degrees (platform or building) */
  previewYaw: number;
  /** Free platform move preview (world XZ) */
  previewWorldX: number;
  previewWorldZ: number;
  /** Free building local placement on platform */
  placeLx: number;
  placeLz: number;
  /** Bridge aim endpoint (world) — snaps to nearest owned platform on confirm */
  bridgeEndX: number;
  bridgeEndZ: number;
  bridgeFacing: 0 | 1 | 2 | 3;
  quotedCost: number;
  offZone: boolean;
}

export function makePlotBuildSession(
  plot: PlotState,
  d: CityDistrictDef,
): PlotBuildSession {
  const cellSize = d.size * 0.26;
  const originX = d.x - cellSize;
  const originZ = d.z - cellSize;
  const homeX = originX + plot.cellX * cellSize;
  const homeZ = originZ + plot.cellY * cellSize;
  const x = typeof plot.worldX === 'number' ? plot.worldX : homeX;
  const z = typeof plot.worldZ === 'number' ? plot.worldZ : homeZ;
  return {
    plotId: plot.id,
    districtId: plot.districtId,
    cellX: plot.cellX,
    cellY: plot.cellY,
    centerX: x,
    centerZ: z,
    cellSize,
    step: 'choose',
    buildKind: null,
    transform: null,
    previewYaw: plot.rotation ?? 0,
    previewWorldX: x,
    previewWorldZ: z,
    placeLx: 0,
    placeLz: 0,
    bridgeEndX: x + cellSize * 0.9,
    bridgeEndZ: z,
    bridgeFacing: 0,
    quotedCost: 0,
    offZone: false,
  };
}

export type PlotPreviewRole = 'current' | 'preview';

/**
 * Footprint box with optional front/entry cue (like stall door notch).
 * facing: 0=+X 1=+Z 2=-X 3=-Z — front edge of the plot section.
 */
export function makePlotSelectionBox(
  cellSize: number,
  opts?: {
    valid?: boolean;
    role?: PlotPreviewRole;
    /** Show front/entry apron on +local Z (rotated by facing) */
    frontCue?: boolean;
    facing?: 0 | 1 | 2 | 3;
    label?: string;
  },
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PlotSelectBox';
  const valid = opts?.valid !== false;
  const role = opts?.role ?? 'preview';
  const half = cellSize * 0.48;
  const size = half * 2;
  const doorW = Math.min(cellSize * 0.38, 4.2);

  // Current = cool/dim; preview = warm/bright green (or red if invalid)
  const fillColor =
    role === 'current' ? 0x7aa8c8 : valid ? 0x66e0a0 : 0xe07070;
  const edgeColor =
    role === 'current' ? 0xa0d0f0 : valid ? 0xa8ffcc : 0xffaaaa;
  // Must read clearly over the plaza deck (was nearly invisible at ~0.12)
  const fillOpacity = role === 'current' ? 0.32 : 0.42;
  const edgeEmissive = role === 'current' ? 0.45 : 0.65;

  const fillMat = new THREE.MeshStandardMaterial({
    color: fillColor,
    transparent: true,
    opacity: fillOpacity,
    depthWrite: false,
    roughness: 0.85,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: edgeColor,
    emissive: edgeColor,
    emissiveIntensity: edgeEmissive,
    transparent: true,
    opacity: role === 'current' ? 0.55 : 0.95,
    depthWrite: false,
  });

  const showFront = !!opts?.frontCue;
  if (showFront) {
    const depth = size - 0.85;
    const main = new THREE.Mesh(new THREE.BoxGeometry(size, 0.07, depth), fillMat);
    main.position.set(0, 0.05, -0.42);
    g.add(main);
    const sideW = (size - doorW) / 2;
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.07, 0.85), fillMat);
      wing.position.set(sx * (doorW / 2 + sideW / 2), 0.05, half - 0.42);
      g.add(wing);
    }
    // Entry apron (reads as door / front)
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(doorW * 0.92, 0.1, 1.2),
      new THREE.MeshStandardMaterial({
        color: role === 'current' ? 0x5aa8c8 : 0x4af0ff,
        emissive: role === 'current' ? 0x226688 : 0x00b8e0,
        emissiveIntensity: role === 'current' ? 0.55 : 1.2,
        transparent: true,
        opacity: role === 'current' ? 0.45 : 0.9,
        depthWrite: false,
      }),
    );
    apron.position.set(0, 0.08, half - 0.5);
    g.add(apron);
    // Arrow pointing out the front
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.7, 5),
      new THREE.MeshStandardMaterial({
        color: role === 'current' ? 0x88cce8 : 0x6afff0,
        emissive: role === 'current' ? 0x224466 : 0x00aacc,
        emissiveIntensity: role === 'current' ? 0.4 : 0.85,
        transparent: true,
        opacity: role === 'current' ? 0.5 : 0.95,
        depthWrite: false,
      }),
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0.55, half + 0.15);
    g.add(arrow);
  } else {
    const fill = new THREE.Mesh(new THREE.BoxGeometry(size, 0.07, size), fillMat);
    fill.position.y = 0.05;
    g.add(fill);
  }

  // Edge rails
  const railH = 0.2;
  const railY = 0.14;
  const addRail = (w: number, d: number, x: number, z: number) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), edgeMat);
    r.position.set(x, railY, z);
    g.add(r);
  };
  addRail(size, 0.14, 0, -half);
  addRail(0.14, size, -half, 0);
  addRail(0.14, size, half, 0);
  if (showFront) {
    const side = (size - doorW) / 2;
    addRail(side, 0.18, -half + side / 2, half);
    addRail(side, 0.18, half - side / 2, half);
  } else {
    addRail(size, 0.14, 0, half);
  }

  // Corner posts
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      if (showFront && sz > 0) continue;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, role === 'current' ? 0.9 : 1.35, 0.16),
        new THREE.MeshStandardMaterial({
          color: role === 'current' ? 0x7a8a9a : 0xc4a35a,
          emissive: role === 'current' ? 0x223344 : 0x664400,
          emissiveIntensity: role === 'current' ? 0.2 : 0.4,
          transparent: true,
          opacity: role === 'current' ? 0.45 : 0.95,
          depthWrite: false,
        }),
      );
      post.position.set(sx * half * 0.96, role === 'current' ? 0.45 : 0.7, sz * half * 0.96);
      g.add(post);
    }
  }

  if (showFront) {
    for (const sx of [-1, 1] as const) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.2, 0.16),
        new THREE.MeshStandardMaterial({
          color: role === 'current' ? 0x6a9aaa : 0x4ae0ff,
          emissive: role === 'current' ? 0x224455 : 0x0088aa,
          emissiveIntensity: role === 'current' ? 0.3 : 0.7,
          transparent: true,
          opacity: role === 'current' ? 0.5 : 0.95,
          depthWrite: false,
        }),
      );
      post.position.set(sx * (doorW * 0.48), 0.6, half);
      g.add(post);
    }
  }

  if (opts?.label) {
    const tag = makeSignSprite(opts.label, { width: 280, maxWidth: 420 });
    setSignWorldWidth(tag, Math.min(cellSize * 0.9, 5.5));
    tag.position.set(0, role === 'current' ? 2.1 : 2.6, 0);
    g.add(tag);
  }

  // Footprint always drawn with front on local +Z; caller rotates the group.
  // opts.facing is kept for API clarity but applied by parent when needed.
  void opts?.facing;

  return g;
}

/** @deprecated use role-aware makePlotSelectionBox */
export function makePlotSelectionBoxLegacy(cellSize: number, valid: boolean): THREE.Group {
  return makePlotSelectionBox(cellSize, { valid, role: 'preview', frontCue: true, facing: 1 });
}

export interface PlotContentOpts {
  role: PlotPreviewRole;
  valid?: boolean;
  /** Override opacity */
  opacity?: number;
  yawDeg?: number;
  bridgeFacing?: number;
}

/**
 * Full content preview for a plot: footprint + structures.
 * Local origin at plot center; apply world position on the group.
 * Whole group is rotated by yawDeg so footprint front (+Z) and buildings share orientation.
 */
export function makePlotContentPreview(
  buildings: PlotBuildingStub[],
  cellSize: number,
  opts: PlotContentOpts,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `PlotContent_${opts.role}`;
  const role = opts.role;
  const valid = opts.valid !== false;
  const opacity =
    opts.opacity ?? (role === 'current' ? 0.38 : 0.88);

  const hasBridge = buildings.some((b) => b.kind === 'bridge');
  const bridgeFacing = (opts.bridgeFacing ??
    buildings.find((b) => b.kind === 'bridge')?.facing ??
    1) as 0 | 1 | 2 | 3;

  // Local +Z front; rotate group so front matches yaw (or bridge out-direction)
  const yawDeg = hasBridge
    ? facingToYaw(bridgeFacing)
    : opts.yawDeg ?? 0;

  const foot = makePlotSelectionBox(cellSize, {
    valid,
    role,
    frontCue: true,
    facing: 1,
    label: role === 'current' ? 'CURRENT' : 'NEW',
  });
  g.add(foot);

  for (const b of buildings) {
    if (b.kind === 'empty') continue;
    if (b.kind === 'bridge') {
      // Player bridge width 3× — preview only; world span uses buildWorldSpanRopeBridge
      const br = buildRopePlankBridgeMesh(cellSize, 1, true, opacity, 3);
      br.position.z += cellSize * 0.35;
      g.add(br);
      continue;
    }
    const piece = makeSolidStructure(b.kind, cellSize, opacity, role);
    piece.position.set(b.lx ?? 0, 0, b.lz ?? 0);
    if (typeof b.yaw === 'number') piece.rotation.y = (b.yaw * Math.PI) / 180;
    g.add(piece);
  }

  g.rotation.y = (yawDeg * Math.PI) / 180;
  return g;
}

function facingToYaw(facing: 0 | 1 | 2 | 3): number {
  // 0=+X 1=+Z 2=-X 3=-Z → degrees (0 = +Z front)
  return [90, 0, 270, 180][facing]!;
}

/** Preview for placing one new build kind onto (possibly empty) plot */
export function makePlotBuildGhost(
  kind: PlotBuildKind,
  cellSize: number,
  opts?: {
    bridgeFacing?: number;
    valid?: boolean;
    yawDeg?: number;
    role?: PlotPreviewRole;
    opacity?: number;
    lx?: number;
    lz?: number;
    /** Platform yaw for footprint */
    platformYaw?: number;
  },
): THREE.Group {
  const role = opts?.role ?? 'preview';
  const buildings: PlotBuildingStub[] =
    kind === 'bridge'
      ? [{ kind: 'bridge', facing: opts?.bridgeFacing ?? 1, lx: 0, lz: 0 }]
      : [{ kind, lx: opts?.lx ?? 0, lz: opts?.lz ?? 0, yaw: opts?.yawDeg ?? 0 }];
  return makePlotContentPreview(buildings, cellSize, {
    role,
    valid: opts?.valid,
    opacity: opts?.opacity ?? (role === 'preview' ? 0.88 : 0.38),
    yawDeg: opts?.platformYaw ?? 0,
    bridgeFacing: opts?.bridgeFacing ?? 1,
  });
}

/** Snapshot of existing plot for “current” ghost */
export function makePlotCurrentGhost(
  plot: PlotState,
  cellSize: number,
): THREE.Group {
  return makePlotContentPreview(plot.buildings ?? [], cellSize, {
    role: 'current',
    valid: true,
    yawDeg: plot.rotation ?? 0,
  });
}

function makeSolidStructure(
  kind: PlotBuildKind,
  cellSize: number,
  opacity: number,
  role: PlotPreviewRole,
): THREE.Group {
  const g = new THREE.Group();
  // Floor clamp — never nearly invisible
  const op = Math.max(role === 'current' ? 0.35 : 0.75, Math.min(0.95, opacity));
  const mat = (color: number, metal = 0.15) =>
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: op,
      roughness: 0.65,
      metalness: metal,
      depthWrite: false,
      depthTest: true,
      emissive: color,
      emissiveIntensity: role === 'preview' ? 0.22 : 0.1,
    });

  if (kind === 'apartment' || kind === 'home') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.55, 2.4, cellSize * 0.4),
      mat(0x8a7060),
    );
    body.position.y = 1.2;
    g.add(body);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.18, 1.1, 0.1),
      mat(role === 'preview' ? 0x4af0ff : 0x6a90a8),
    );
    door.position.set(0, 0.7, cellSize * 0.22);
    g.add(door);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.6, 0.25, cellSize * 0.45),
      mat(0x5a4030),
    );
    roof.position.y = 2.5;
    g.add(roof);
  } else if (kind === 'factory') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.5, 1.8, cellSize * 0.45),
      mat(0x5a5850, 0.35),
    );
    body.position.y = 0.9;
    g.add(body);
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 2.2, 8),
      mat(0x444440, 0.4),
    );
    stack.position.set(cellSize * 0.12, 2.2, 0);
    g.add(stack);
    const bay = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.22, 1.0, 0.12),
      mat(role === 'preview' ? 0x4af0ff : 0x4a6070),
    );
    bay.position.set(0, 0.65, cellSize * 0.24);
    g.add(bay);
  } else if (kind === 'retail') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.5, 1.6, cellSize * 0.35),
      mat(0x6a7a88),
    );
    body.position.y = 0.8;
    g.add(body);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.55, 0.12, 0.5),
      mat(0xc05040),
    );
    awning.position.set(0, 1.55, cellSize * 0.12);
    g.add(awning);
  } else if (kind === 'garden') {
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(cellSize * 0.28, cellSize * 0.3, 0.25, 8),
      mat(0x3a4830),
    );
    soil.position.y = 0.15;
    g.add(soil);
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), mat(0xd4a84a));
      fl.position.set(
        Math.cos(i * 1.4) * cellSize * 0.15,
        0.55,
        Math.sin(i * 1.4) * cellSize * 0.15,
      );
      g.add(fl);
    }
  } else if (kind === 'decor') {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.5, 0.28),
      mat(0xc4a35a, 0.4),
    );
    post.position.y = 0.75;
    g.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(0xffe8a0));
    lamp.position.y = 1.65;
    g.add(lamp);
  } else {
    // Fallback cube so unknown kinds still read in preview
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.4, 1.2, cellSize * 0.4),
      mat(0x88aacc),
    );
    box.position.y = 0.6;
    g.add(box);
  }
  return g;
}

/**
 * Rope-and-plank sky bridge along local +Z by default; facing rotates yaw.
 * facing: 0=+X 1=+Z 2=-X 3=-Z
 */
/** Shared mats so hundreds of bridges don't allocate unique materials. */
let _bridgeMatsSolid: {
  wood: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
  post: THREE.MeshStandardMaterial;
} | null = null;
let _bridgeMatsGhost: {
  wood: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
  post: THREE.MeshStandardMaterial;
} | null = null;

function bridgeMats(ghost: boolean) {
  if (ghost) {
    if (!_bridgeMatsGhost) {
      _bridgeMatsGhost = {
        wood: new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.92,
          metalness: 0.04,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          emissive: 0x3a2208,
          emissiveIntensity: 0.15,
        }),
        rope: new THREE.MeshStandardMaterial({
          color: 0xc9a66a,
          roughness: 0.88,
          metalness: 0.08,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          emissive: 0x554418,
          emissiveIntensity: 0.12,
        }),
        post: new THREE.MeshStandardMaterial({
          color: 0x5c3d28,
          roughness: 0.85,
          metalness: 0.08,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          emissive: 0x2a1810,
          emissiveIntensity: 0.1,
        }),
      };
    }
    return _bridgeMatsGhost;
  }
  if (!_bridgeMatsSolid) {
    _bridgeMatsSolid = {
      wood: new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.92,
        metalness: 0.04,
        emissive: 0x3a2208,
        emissiveIntensity: 0.02,
      }),
      rope: new THREE.MeshStandardMaterial({
        color: 0xc9a66a,
        roughness: 0.88,
        metalness: 0.08,
        emissive: 0x554418,
        emissiveIntensity: 0.02,
      }),
      post: new THREE.MeshStandardMaterial({
        color: 0x5c3d28,
        roughness: 0.85,
        metalness: 0.08,
        emissive: 0x2a1810,
        emissiveIntensity: 0.02,
      }),
    };
  }
  return _bridgeMatsSolid;
}

// Shared low-poly geometries (scaled/positioned per instance)
const _postGeo = new THREE.BoxGeometry(0.1, 1.05, 0.1);
/** Unit plank: X scaled to deck width; Z = along-span depth (fixed visual width) */
const _plankGeo = new THREE.BoxGeometry(1, 0.08, 1);
const _ropeGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 4);

/** Fixed plank depth along the span — more boards as bridge lengthens */
const PLANK_ALONG = 0.4;
/** Center spacing of planks along the span (slight gap between boards) */
const PLANK_SPACING = 0.52;
/** Local Y of plank centers (group origin = deckY) */
const PLANK_Y = 0.16;
const PLANK_HALF_H = 0.04;
/** Rope lateral offset as fraction of halfW (matches mesh) */
const ROPE_X_FRAC = 0.98;
/** Rope local Y base before sag (matches mesh) */
const ROPE_Y_BASE = 0.88;
/** Rope sag as fraction of deck sag amp */
const ROPE_SAG_MUL = 0.9;
/** Thin solid radius around each rope segment */
const ROPE_COL_R = 0.11;

/**
 * Half-width of bridge deck from short-end width multiplier.
 * Base unit 0.45 → widthMul 6 ≈ 5.4u short-end width (4× prior island bridges).
 */
export function bridgeHalfWidth(widthMul = BRIDGE_WIDTH_MUL): number {
  return 0.45 * Math.max(1, widthMul);
}

/** Shared layout for mesh + colliders so ropes/floors stay aligned. */
function bridgeLayout(len: number, widthMul: number) {
  const halfW = bridgeHalfWidth(widthMul);
  const halfL = len * 0.5;
  const sagAmp = Math.min(0.32, Math.max(0.06, len * 0.028));
  // Fixed board size along span → more planks when longer (no artificial low cap)
  const usable = len * 0.96;
  const plankCount = Math.max(3, Math.ceil(usable / PLANK_SPACING));
  const ropeSegs = Math.max(4, Math.ceil(len / 1.15));
  return { halfW, halfL, sagAmp, plankCount, ropeSegs, usable };
}

function plankLocalZ(i: number, plankCount: number, halfL: number, usable: number): number {
  const t = plankCount <= 1 ? 0.5 : i / (plankCount - 1);
  return -halfL * 0.96 + t * usable;
}

function ropeLocalY(t: number, sagAmp: number): number {
  return ROPE_Y_BASE - Math.sin(t * Math.PI) * sagAmp * ROPE_SAG_MUL;
}

/**
 * Rope-plank sky bridge (island style).
 * Local +Z = long span between platforms; local ±X = short ends (width).
 * End posts sit on facing platform edge midpoints.
 */
export function buildRopePlankBridgeMesh(
  cellSize: number,
  facing: number,
  ghost = false,
  _opacityOverride?: number,
  widthMul = BRIDGE_WIDTH_MUL,
  lengthOverride?: number,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'RopePlankBridge';
  const len = Math.max(1.2, lengthOverride ?? cellSize * 0.95);
  const { halfW, halfL, sagAmp, plankCount, ropeSegs, usable } = bridgeLayout(len, widthMul);
  const mats = bridgeMats(ghost);

  const yaw = (facing % 4) * (Math.PI / 2);
  g.rotation.y = yaw;

  const markShared = (m: THREE.Mesh) => {
    m.userData.sharedAssets = true;
  };

  // Corner posts on short ends (platform edge attachments)
  for (const z of [-halfL, halfL]) {
    for (const x of [-halfW, halfW]) {
      const post = new THREE.Mesh(_postGeo, mats.post);
      post.position.set(x, 0.525, z);
      markShared(post);
      g.add(post);
    }
  }

  // Deck planks: fixed along-span size; count grows with length
  const plankW = halfW * 2 * 0.96;
  for (let i = 0; i < plankCount; i++) {
    const t = plankCount <= 1 ? 0.5 : i / (plankCount - 1);
    const z = plankLocalZ(i, plankCount, halfL, usable);
    const sag = Math.sin(t * Math.PI) * sagAmp;
    const plank = new THREE.Mesh(_plankGeo, mats.wood);
    plank.scale.set(plankW, 1, PLANK_ALONG);
    plank.position.set(0, PLANK_Y - sag, z);
    markShared(plank);
    g.add(plank);
  }

  // Rope rails along both long sides — same path as colliders/grind
  for (const x of [-halfW * ROPE_X_FRAC, halfW * ROPE_X_FRAC]) {
    for (let i = 0; i < ropeSegs; i++) {
      const t0 = i / ropeSegs;
      const t1 = (i + 1) / ropeSegs;
      const z0 = -halfL + t0 * len;
      const z1 = -halfL + t1 * len;
      const y0 = ropeLocalY(t0, sagAmp);
      const y1 = ropeLocalY(t1, sagAmp);
      const dy = y1 - y0;
      const dz = z1 - z0;
      const segLen = Math.hypot(dy, dz);
      if (segLen < 0.02) continue;
      const seg = new THREE.Mesh(_ropeGeo, mats.rope);
      seg.scale.set(1, segLen, 1);
      seg.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
      const dir = new THREE.Vector3(0, dy, dz).normalize();
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      markShared(seg);
      g.add(seg);
    }
  }

  return g;
}

/**
 * Group Y so visual plank tops align with a platform walk surface Y.
 * (Plank center at PLANK_Y, half-height PLANK_HALF_H.)
 */
export function bridgeDeckYForWalkSurface(walkSurfaceY: number): number {
  return walkSurfaceY - PLANK_Y - PLANK_HALF_H;
}

/**
 * World-space rope bridge from attach A→B (short ends on pads).
 * Colliders are rebuilt from the same span vectors as the mesh rotation/scale
 * so floors and rope rails stay correct as pads move.
 */
export function buildWorldSpanRopeBridge(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  widthMul: number,
  deckY: number,
  ghost = false,
): { group: THREE.Group; colliders: Collider[]; rails: RaceRail[] } {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  const g = new THREE.Group();
  g.name = 'WorldSpanRopeBridge';
  const rails: RaceRail[] = [];
  if (len < 1.2) {
    return { group: g, colliders: [], rails };
  }
  const { halfW, sagAmp, plankCount, ropeSegs, usable } = bridgeLayout(len, widthMul);
  const halfL = len * 0.5;
  const ux = dx / len;
  const uz = dz / len;
  // Local +X of the bridge (across short ends) = perpendicular in XZ
  const px = -uz;
  const pz = ux;
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;

  // Mesh: positioned at span center, rotated so local +Z = A→B
  g.position.set(mx, deckY, mz);
  g.rotation.y = Math.atan2(dx, dz);
  const br = buildRopePlankBridgeMesh(
    Math.max(len, 4),
    1,
    ghost,
    ghost ? 0.8 : 1,
    widthMul,
    len,
  );
  g.add(br);

  const colliders: Collider[] = [];
  if (!ghost) {
    // Flat walk surface (no sag holes) — dense segments follow the rotated span
    // so AABBs track placement after every pad move rebuild.
    const walkTop = deckY + PLANK_Y + PLANK_HALF_H + 0.1;
    const walkBot = deckY - 0.2;
    const floorSegs = Math.max(plankCount + 1, Math.ceil(len / 0.4));
    const floorHalfAlong = (len / floorSegs) * 0.55 + 0.08;
    const floorHalfAcross = halfW + 0.2;
    for (let i = 0; i < floorSegs; i++) {
      const t = (i + 0.5) / floorSegs;
      // Parametric from A→B (same as mesh long axis)
      const wx = ax + dx * t;
      const wz = az + dz * t;
      const extX =
        Math.abs(ux) * floorHalfAlong + Math.abs(px) * floorHalfAcross;
      const extZ =
        Math.abs(uz) * floorHalfAlong + Math.abs(pz) * floorHalfAcross;
      colliders.push({
        min: new THREE.Vector3(wx - extX, walkBot, wz - extZ),
        max: new THREE.Vector3(wx + extX, walkTop, wz + extZ),
        kind: 'floor',
      });
    }

    // Rope solids + grind: same lateral offset as mesh (±halfW * ROPE_X_FRAC)
    for (const side of [-1, 1] as const) {
      const ox = px * halfW * ROPE_X_FRAC * side;
      const oz = pz * halfW * ROPE_X_FRAC * side;
      for (let i = 0; i < ropeSegs; i++) {
        const t0 = i / ropeSegs;
        const t1 = (i + 1) / ropeSegs;
        const tm = (t0 + t1) / 2;
        // Match mesh: localZ = -halfL + t * len → world = mid + ux*localZ
        const localZ = -halfL + tm * len;
        const wx = mx + ux * localZ + ox;
        const wz = mz + uz * localZ + oz;
        const y0 = ropeLocalY(t0, sagAmp);
        const y1 = ropeLocalY(t1, sagAmp);
        const yMid = deckY + (y0 + y1) / 2;
        const segAlong = (len / ropeSegs) * 0.55 + 0.05;
        const extX = Math.abs(ux) * segAlong + ROPE_COL_R;
        const extZ = Math.abs(uz) * segAlong + ROPE_COL_R;
        colliders.push({
          min: new THREE.Vector3(wx - extX, yMid - ROPE_COL_R, wz - extZ),
          max: new THREE.Vector3(wx + extX, yMid + ROPE_COL_R + 0.1, wz + extZ),
          kind: 'solid',
        });
      }
      const pts: THREE.Vector3[] = [];
      const samples = Math.max(4, ropeSegs);
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const localZ = -halfL + t * len;
        pts.push(
          new THREE.Vector3(
            mx + ux * localZ + ox,
            deckY + ropeLocalY(t, sagAmp),
            mz + uz * localZ + oz,
          ),
        );
      }
      rails.push({ points: pts });
    }

    // Also stamp floor under each visual plank station (extra grip / no seams)
    for (let i = 0; i < plankCount; i++) {
      const localZ = plankLocalZ(i, plankCount, halfL, usable);
      const wx = mx + ux * localZ;
      const wz = mz + uz * localZ;
      const ha = PLANK_ALONG * 0.55 + 0.1;
      const hc = halfW * 0.98 + 0.15;
      const extX = Math.abs(ux) * ha + Math.abs(px) * hc;
      const extZ = Math.abs(uz) * ha + Math.abs(pz) * hc;
      colliders.push({
        min: new THREE.Vector3(wx - extX, walkBot, wz - extZ),
        max: new THREE.Vector3(wx + extX, walkTop, wz + extZ),
        kind: 'floor',
      });
    }
  }
  return { group: g, colliders, rails };
}

export function plotBuildCatalogLabel(kind: PlotBuildKind): string {
  return PLOT_BUILD_CATALOG.find((c) => c.kind === kind)?.name ?? kind;
}

export function canPlaceBridgeOnPlot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any,
  plot: PlotState,
): boolean {
  return hasAdjacentOwned(state, plot);
}

/** Move dir 0=+X 1=+Z 2=-X 3=-Z → facing for bridge/front */
export function moveDirToFacing(dir: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
  return dir;
}
