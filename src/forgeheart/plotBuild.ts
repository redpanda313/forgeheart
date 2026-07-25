/**
 * Plot build mode — place structures on owned plaza pads.
 * Free local placement + yaw; door/front cue on local +Z.
 */

import * as THREE from 'three';
import type { PlotBuildKind, PlotBuildingStub, PlotState } from './plazaPlots';
import {
  PLOT_BUILD_CATALOG,
  buildingFootprintHalf,
  validatePlotBuildingPlace,
} from './plazaPlots';
import type { CityDistrictDef } from './economy';
import { makeSignSprite, setSignWorldWidth } from './signLabel';

export type PlotBuildModeStep = 'choose' | 'place';

export interface PlotBuildSession {
  plotId: string;
  districtId: string;
  cellX: number;
  cellY: number;
  /** Platform center (world XZ) */
  centerX: number;
  centerZ: number;
  cellSize: number;
  step: PlotBuildModeStep;
  buildKind: PlotBuildKind | null;
  /** Building yaw degrees (door faces local +Z after yaw) */
  previewYaw: number;
  /** Building local placement on platform */
  placeLx: number;
  placeLz: number;
  quotedCost: number;
  offZone: boolean;
  /** Last placement validity (overlap / on-pad) */
  placeValid: boolean;
  /** Deck layer for placement (0 ground, 1 upper) */
  placeLayer: number;
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
    previewYaw: 0,
    placeLx: 0,
    placeLz: 0,
    quotedCost: 0,
    offZone: false,
    placeValid: true,
    placeLayer: 0,
  };
}

export type PlotPreviewRole = 'current' | 'preview';

/**
 * Footprint pad outline (no pad transform tools — fixed platform).
 */
export function makePlotSelectionBox(
  cellSize: number,
  opts?: {
    valid?: boolean;
    role?: PlotPreviewRole;
    frontCue?: boolean;
    label?: string;
  },
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PlotSelectBox';
  const valid = opts?.valid !== false;
  const role = opts?.role ?? 'preview';
  const half = cellSize * 0.48;
  const size = half * 2;

  const fillColor = role === 'current' ? 0x7aa8c8 : valid ? 0x66e0a0 : 0xe07070;
  const edgeColor = role === 'current' ? 0xa0d0f0 : valid ? 0xa8ffcc : 0xffaaaa;
  const fillOpacity = role === 'current' ? 0.28 : 0.38;

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
    emissiveIntensity: role === 'current' ? 0.35 : 0.55,
    transparent: true,
    opacity: role === 'current' ? 0.45 : 0.85,
    depthWrite: false,
  });

  const fill = new THREE.Mesh(new THREE.BoxGeometry(size, 0.06, size), fillMat);
  fill.position.y = 0.04;
  g.add(fill);

  const railH = 0.16;
  const addRail = (w: number, d: number, x: number, z: number) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), edgeMat);
    r.position.set(x, 0.12, z);
    g.add(r);
  };
  addRail(size, 0.12, 0, -half);
  addRail(size, 0.12, 0, half);
  addRail(0.12, size, -half, 0);
  addRail(0.12, size, half, 0);

  if (opts?.label) {
    const tag = makeSignSprite(opts.label, { width: 280, maxWidth: 420 });
    setSignWorldWidth(tag, Math.min(cellSize * 0.9, 5.5));
    tag.position.set(0, role === 'current' ? 2.0 : 2.4, 0);
    g.add(tag);
  }
  return g;
}

/** Door / opening cue on local +Z of a building (caller applies building yaw). */
export function makeDoorFacingCue(role: PlotPreviewRole = 'preview'): THREE.Group {
  const g = new THREE.Group();
  g.name = 'DoorFacingCue';
  const bright = role === 'preview';
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 0.9),
    new THREE.MeshStandardMaterial({
      color: bright ? 0x4af0ff : 0x5aa8c8,
      emissive: bright ? 0x00b8e0 : 0x226688,
      emissiveIntensity: bright ? 1.1 : 0.45,
      transparent: true,
      opacity: bright ? 0.9 : 0.45,
      depthWrite: false,
    }),
  );
  apron.position.set(0, 0.06, 0.55);
  g.add(apron);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.85, 5),
    new THREE.MeshStandardMaterial({
      color: bright ? 0x6afff0 : 0x88cce8,
      emissive: bright ? 0x00aacc : 0x224466,
      emissiveIntensity: bright ? 0.9 : 0.35,
      transparent: true,
      opacity: bright ? 0.95 : 0.5,
      depthWrite: false,
    }),
  );
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.65, 1.15);
  g.add(arrow);
  const label = makeSignSprite('ENTRY →', { width: 200, maxWidth: 280 });
  setSignWorldWidth(label, 2.2);
  label.position.set(0, 1.5, 1.0);
  g.add(label);
  return g;
}

function makeSolidStructure(
  kind: PlotBuildKind,
  cellSize: number,
  opacity: number,
  role: PlotPreviewRole,
): THREE.Group {
  const g = new THREE.Group();
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

  const { hw, hd } = buildingFootprintHalf(kind, cellSize);
  const w = hw * 2;
  const d = hd * 2;

  if (kind === 'apartment' || kind === 'home') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), mat(0x8a7060));
    body.position.y = 1.25;
    g.add(body);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.35, 1.8), 1.2, 0.12),
      mat(role === 'preview' ? 0x4af0ff : 0x6a90a8),
    );
    door.position.set(0, 0.7, d / 2 + 0.02);
    g.add(door);
  } else if (kind === 'factory') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.9, d), mat(0x5a5850, 0.25));
    body.position.y = 0.95;
    g.add(body);
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), mat(0x444440, 0.3));
    stack.position.set(w * 0.25, 2.0, 0);
    g.add(stack);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.4, 2.2), 1.4, 0.12),
      mat(role === 'preview' ? 0x4af0ff : 0x888888),
    );
    door.position.set(0, 0.8, d / 2 + 0.02);
    g.add(door);
  } else if (kind === 'retail') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.7, d), mat(0x6a7a88, 0.2));
    body.position.y = 0.85;
    g.add(body);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.4, 2.4), 1.3, 0.12),
      mat(role === 'preview' ? 0x4af0ff : 0x88aacc),
    );
    door.position.set(0, 0.75, d / 2 + 0.02);
    g.add(door);
  } else if (kind === 'garden') {
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.min(hw, hd), Math.min(hw, hd) * 1.05, 0.25, 10),
      mat(0x3a4830),
    );
    soil.position.y = 0.15;
    g.add(soil);
  } else if (kind === 'decor') {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.5, 0.28), mat(0xc4a35a, 0.35));
    post.position.y = 0.75;
    g.add(post);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), mat(0x888888));
    body.position.y = 0.75;
    g.add(body);
  }

  // Door facing cue for placeable shells (not garden/decor)
  if (kind !== 'garden' && kind !== 'decor' && kind !== 'empty') {
    const cue = makeDoorFacingCue(role);
    cue.position.z = d / 2;
    g.add(cue);
  }
  return g;
}

/**
 * Existing buildings on the pad (dim “current”).
 */
export function makePlotCurrentGhost(plot: PlotState, cellSize: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PlotContent_current';
  g.add(makePlotSelectionBox(cellSize, { role: 'current', valid: true, label: 'PAD' }));
  for (const b of plot.buildings ?? []) {
    if (b.kind === 'empty' || b.kind === 'bridge') continue;
    const piece = makeSolidStructure(b.kind, cellSize, 0.4, 'current');
    piece.position.set(b.lx ?? 0, 0, b.lz ?? 0);
    piece.rotation.y = ((b.yaw ?? 0) * Math.PI) / 180;
    g.add(piece);
  }
  return g;
}

/**
 * Preview for placing one new building — door faces local +Z after yaw.
 */
export function makePlotBuildGhost(
  kind: PlotBuildKind,
  cellSize: number,
  opts?: {
    valid?: boolean;
    yawDeg?: number;
    role?: PlotPreviewRole;
    opacity?: number;
    lx?: number;
    lz?: number;
  },
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PlotBuildGhost';
  const role = opts?.role ?? 'preview';
  const valid = opts?.valid !== false;
  g.add(
    makePlotSelectionBox(cellSize, {
      role,
      valid,
      label: role === 'preview' ? 'NEW' : 'CURRENT',
    }),
  );
  if (kind === 'empty' || kind === 'bridge') return g;
  const piece = makeSolidStructure(kind, cellSize, opts?.opacity ?? 0.9, role);
  piece.position.set(opts?.lx ?? 0, 0, opts?.lz ?? 0);
  piece.rotation.y = ((opts?.yawDeg ?? 0) * Math.PI) / 180;
  if (!valid) {
    piece.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material && 'color' in o.material) {
        (o.material as THREE.MeshStandardMaterial).color?.setHex?.(0xaa5555);
      }
    });
  }
  g.add(piece);
  return g;
}

/** @deprecated kept for any residual calls */
export function makePlotContentPreview(
  buildings: PlotBuildingStub[],
  cellSize: number,
  opts: { role: PlotPreviewRole; valid?: boolean; opacity?: number; yawDeg?: number },
): THREE.Group {
  const fake: PlotState = {
    id: '',
    districtId: '',
    cellX: 0,
    cellY: 0,
    owner: 'player',
    npcOwnerId: null,
    zoningHint: 'mixed',
    buildings,
    rentPolicy: null,
    tenantNeighborId: null,
    shape: 'square',
    rotation: opts.yawDeg ?? 0,
    layer: 0,
    listPrice: 0,
    forSale: false,
    vacant: false,
  };
  return makePlotCurrentGhost(fake, cellSize);
}

export function plotBuildCatalogLabel(kind: PlotBuildKind): string {
  return PLOT_BUILD_CATALOG.find((c) => c.kind === kind)?.name ?? kind;
}

/** Validate building placement on a plot (overlap + still touches pad). */
export function validateBuildingPlacement(
  plot: PlotState,
  kind: PlotBuildKind,
  cellSize: number,
  lx: number,
  lz: number,
  yaw: number,
  placeLayer = 0,
): { ok: boolean; msg?: string } {
  return validatePlotBuildingPlace(plot, kind, cellSize, lx, lz, yaw, placeLayer);
}
