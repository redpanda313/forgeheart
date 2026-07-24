/**
 * Plot build mode — site-builder style placement for plaza plots (Tasks 7–8).
 * Ghost meshes + rope-plank bridges.
 */

import * as THREE from 'three';
import type { PlotBuildKind, PlotState } from './plazaPlots';
import { PLOT_BUILD_CATALOG, plotWorldCenter, hasAdjacentOwned } from './plazaPlots';
import type { CityDistrictDef } from './economy';

export type PlotBuildModeStep = 'choose' | 'place' | 'transform';

export type PlotTransformTool = 'rotate' | 'move';

export interface PlotBuildSession {
  plotId: string;
  districtId: string;
  cellX: number;
  cellY: number;
  /** World center of the plot */
  centerX: number;
  centerZ: number;
  cellSize: number;
  step: PlotBuildModeStep;
  /** Selected catalog kind when building */
  buildKind: PlotBuildKind | null;
  /** Transform mode */
  transform: PlotTransformTool | null;
  /** Preview rotation degrees */
  previewYaw: number;
  /** Move direction 0=+X 1=+Z 2=-X 3=-Z */
  moveDir: 0 | 1 | 2 | 3;
  /** Bridge facing same as moveDir */
  bridgeFacing: 0 | 1 | 2 | 3;
  quotedCost: number;
  offZone: boolean;
}

export function makePlotBuildSession(
  plot: PlotState,
  d: CityDistrictDef,
): PlotBuildSession {
  const { x, z, cellSize } = plotWorldCenter(d, plot.cellX, plot.cellY);
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
    moveDir: 0,
    bridgeFacing: 0,
    quotedCost: 0,
    offZone: false,
  };
}

/** Footprint selection box (like stall site box) */
export function makePlotSelectionBox(cellSize: number, valid: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'PlotSelectBox';
  const half = cellSize * 0.46;
  const color = valid ? 0x44cc88 : 0xcc4444;
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(half * 2, 0.35, half * 2)),
    new THREE.LineBasicMaterial({ color }),
  );
  edge.position.y = 0.2;
  g.add(edge);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2, half * 2),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.06;
  g.add(floor);
  // Corner posts
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.9, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xc4a35a,
        emissive: 0x664400,
        emissiveIntensity: 0.35,
      }),
    );
    post.position.set(sx * half * 0.95, 0.45, sz * half * 0.95);
    g.add(post);
  }
  return g;
}

/** Building ghost (translucent) — local origin at plot center */
export function makePlotBuildGhost(
  kind: PlotBuildKind,
  cellSize: number,
  opts?: { bridgeFacing?: number; valid?: boolean },
): THREE.Group {
  const g = new THREE.Group();
  g.name = `PlotGhost_${kind}`;
  const valid = opts?.valid !== false;
  const tint = valid ? 0x66ddaa : 0xdd6666;
  const opacity = 0.45;

  const mat = (color: number, metal = 0.15) =>
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.7,
      metalness: metal,
      depthWrite: false,
    });

  if (kind === 'bridge') {
    g.add(buildRopePlankBridgeMesh(cellSize, opts?.bridgeFacing ?? 0, true));
    return g;
  }

  if (kind === 'apartment' || kind === 'home') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.55, 2.4, cellSize * 0.4),
      mat(0x8a7060),
    );
    body.position.y = 1.2;
    g.add(body);
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
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        mat(0xd4a84a),
      );
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
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      mat(0xffe8a0),
    );
    lamp.position.y = 1.65;
    g.add(lamp);
  } else {
    // empty / unknown — tinted pad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(cellSize * 0.8, cellSize * 0.8),
      mat(tint),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.08;
    g.add(pad);
  }

  // Validity rim
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(cellSize * 0.7, 0.2, cellSize * 0.7)),
    new THREE.LineBasicMaterial({ color: tint }),
  );
  rim.position.y = 0.12;
  g.add(rim);
  return g;
}

/**
 * Rope-and-plank sky bridge along local +Z by default; facing rotates yaw.
 * facing: 0=+X 1=+Z 2=-X 3=-Z
 */
export function buildRopePlankBridgeMesh(
  cellSize: number,
  facing: number,
  ghost = false,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'RopePlankBridge';
  const len = cellSize * 0.95;
  const opacity = ghost ? 0.5 : 1;
  const wood = new THREE.MeshStandardMaterial({
    color: 0x8a6a40,
    roughness: 0.9,
    metalness: 0.05,
    transparent: ghost,
    opacity,
    depthWrite: !ghost,
  });
  const rope = new THREE.MeshStandardMaterial({
    color: 0xc4a878,
    roughness: 0.85,
    metalness: 0.1,
    transparent: ghost,
    opacity,
    depthWrite: !ghost,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x5a4030,
    roughness: 0.8,
    metalness: 0.1,
    transparent: ghost,
    opacity,
    depthWrite: !ghost,
  });

  // Orient: default bridge extends along +Z from near edge toward far
  const yaw = (facing % 4) * (Math.PI / 2);
  g.rotation.y = yaw;

  // End posts (near and far)
  for (const z of [-len * 0.42, len * 0.42]) {
    for (const x of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), postMat);
      post.position.set(x, 0.55, z);
      g.add(post);
    }
  }

  // Planks across the span
  const plankCount = Math.max(6, Math.round(len / 0.55));
  for (let i = 0; i < plankCount; i++) {
    const t = plankCount <= 1 ? 0.5 : i / (plankCount - 1);
    const z = -len * 0.4 + t * len * 0.8;
    // Slight sway sag
    const sag = Math.sin(t * Math.PI) * 0.12;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.07, 0.38),
      wood,
    );
    plank.position.set(0, 0.28 - sag, z);
    // Tiny random twist for handmade feel (deterministic by index)
    plank.rotation.y = ((i % 3) - 1) * 0.04;
    g.add(plank);
  }

  // Side ropes (top hand lines + bottom under-lines)
  const ropeSegs = 12;
  for (const x of [-0.52, 0.52]) {
    for (const yBase of [0.95, 0.32]) {
      for (let i = 0; i < ropeSegs; i++) {
        const t0 = i / ropeSegs;
        const t1 = (i + 1) / ropeSegs;
        const z0 = -len * 0.42 + t0 * len * 0.84;
        const z1 = -len * 0.42 + t1 * len * 0.84;
        const sag0 = Math.sin(t0 * Math.PI) * (yBase > 0.5 ? 0.18 : 0.1);
        const sag1 = Math.sin(t1 * Math.PI) * (yBase > 0.5 ? 0.18 : 0.1);
        const y0 = yBase - sag0;
        const y1 = yBase - sag1;
        const dx = 0;
        const dy = y1 - y0;
        const dz = z1 - z0;
        const segLen = Math.hypot(dx, dy, dz);
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, segLen, 5),
          rope,
        );
        seg.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
        // Align cylinder (default Y-up) to segment direction
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir,
        );
        seg.quaternion.copy(quat);
        g.add(seg);
      }
    }
    // Vertical hangers from top rope to plank line
    for (let i = 1; i < plankCount; i += 2) {
      const t = i / (plankCount - 1);
      const z = -len * 0.4 + t * len * 0.8;
      const sag = Math.sin(t * Math.PI) * 0.18;
      const topY = 0.95 - sag;
      const botY = 0.32 - Math.sin(t * Math.PI) * 0.1;
      const h = topY - botY;
      const hang = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, h, 4),
        rope,
      );
      hang.position.set(x, (topY + botY) / 2, z);
      g.add(hang);
    }
  }

  return g;
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
