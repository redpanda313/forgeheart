/**
 * Lightweight enterable building shells for sky-city plazas.
 * Adapted from floatingCity buildBuilding (home / shop) with world-space colliders.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { Collider } from './level';
import { JUMP_H, PLAYER_H } from './level';
import { makeSignSprite } from './signLabel';

export type EnterableKind = 'home' | 'shop' | 'office';

export type EnterableBuilt = {
  group: THREE.Group;
  colliders: Collider[];
  /** World-space point just inside the door */
  interiorSpot: THREE.Vector3;
  doorWorld: THREE.Vector3;
};

/**
 * Clearance from floor surface to ceiling underside so a full jump cannot
 * drive the head through the roof (standing head + JUMP_H + margin).
 */
export function interiorClearanceHeight(): number {
  return PLAYER_H * 0.95 + JUMP_H + 0.45;
}

/** Story height (floor surface to next floor / roof underside). */
export function enterableFloorHeight(_kind?: EnterableKind): number {
  // Base interior clearance + floor slab thickness budget
  return Math.max(3.65, interiorClearanceHeight() + 0.35);
}

function addBox(
  g: THREE.Group,
  cols: Collider[],
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  kind: 'floor' | 'solid',
  opts?: { structureWall?: boolean },
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts?.structureWall) mesh.userData.structureWall = true;
  g.add(mesh);
  cols.push({
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    kind,
  });
}

/**
 * Build an enterable shell at world origin of the returned group.
 * Caller positions `group` at (wx, walkY, wz), rotates it, then rebuilds
 * colliders with rotateOffsetColliders so physics matches the visual.
 */
export function buildEnterableShell(
  kind: EnterableKind,
  mats: Mats,
  opts?: { floors?: number; color?: number; label?: string },
): EnterableBuilt {
  const g = new THREE.Group();
  g.name = `Enterable_${kind}`;
  const cols: Collider[] = [];
  const floors = opts?.floors ?? (kind === 'home' ? 1 : 2);
  const wallMat = new THREE.MeshStandardMaterial({
    color: opts?.color ?? (kind === 'home' ? 0x8a7060 : kind === 'shop' ? 0x6a7a88 : 0x7a6a58),
    roughness: 0.7,
    metalness: 0.2,
  });
  const floorMat = mats.wood;
  const w = kind === 'shop' ? 8.5 : kind === 'office' ? 9 : 7;
  const d = kind === 'shop' ? 7.5 : kind === 'office' ? 8 : 6.2;
  // Slightly wide door gap so axis-aligned AABBs still leave an enterable opening
  const doorW = kind === 'shop' ? 2.8 : 2.5;
  const floorH = enterableFloorHeight(kind);

  for (let f = 0; f < floors; f++) {
    const y0 = f * floorH + 0.12;
    addBox(g, cols, floorMat, w, 0.22, d, 0, y0, 0, 'floor');
    const wh = floorH - 0.25;
    // Back + sides
    addBox(g, cols, wallMat, w, wh, 0.3, 0, y0 + wh / 2, -d / 2, 'solid', { structureWall: true });
    for (const sx of [-1, 1]) {
      addBox(g, cols, wallMat, 0.3, wh, d, (sx * w) / 2, y0 + wh / 2, 0, 'solid', {
        structureWall: true,
      });
    }
    // Front with door on ground floor
    if (f === 0) {
      const sideW = (w - doorW) / 2;
      for (const sx of [-1, 1]) {
        const cx = sx * (doorW / 2 + sideW / 2);
        addBox(g, cols, wallMat, sideW, wh, 0.3, cx, y0 + wh / 2, d / 2, 'solid', {
          structureWall: true,
        });
      }
      // Lintel
      addBox(g, cols, mats.brass, doorW + 0.25, 0.35, 0.35, 0, y0 + wh - 0.2, d / 2, 'solid', {
        structureWall: true,
      });
    } else {
      addBox(g, cols, wallMat, w, wh, 0.3, 0, y0 + wh / 2, d / 2, 'solid', { structureWall: true });
    }
    // Simple furniture
    if (kind === 'home') {
      addBox(g, cols, mats.woodDark ?? floorMat, 1.5, 0.45, 0.7, 1.4, y0 + 0.35, -1.2, 'solid');
    } else if (kind === 'shop') {
      addBox(g, cols, mats.brass, 2.8, 0.9, 0.7, 0, y0 + 0.55, -1.8, 'solid');
    }
  }

  // Roof / ceiling: solid underside blocks jump (kind solid), top slab walkable
  const roofY = floors * floorH + 0.15;
  // Solid ceiling plate (prevents head pop-through on jump)
  addBox(
    g,
    cols,
    mats.copper ?? mats.brass,
    w + 0.35,
    0.32,
    d + 0.35,
    0,
    roofY,
    0,
    'solid',
    { structureWall: true },
  );
  // Walkable roof surface slightly above solid core
  addBox(g, cols, mats.copper ?? mats.brass, w + 0.45, 0.2, d + 0.45, 0, roofY + 0.22, 0, 'floor');

  if (opts?.label) {
    const spr = makeSignSprite(opts.label, {
      width: 256,
      maxWidth: 560,
      height: 64,
      maxHeight: 160,
      maxFont: 22,
      minFont: 11,
      fontFamily: 'system-ui,sans-serif',
      fill: 'rgba(20,16,12,0.75)',
      stroke: '#c4a35a',
      textColor: '#f0e0b0',
      worldWidth: 3.2,
    });
    spr.position.set(0, roofY + 1.1, d / 2 + 0.2);
    g.add(spr);
  }

  return {
    group: g,
    colliders: cols,
    interiorSpot: new THREE.Vector3(0, 1.6, -0.5),
    doorWorld: new THREE.Vector3(0, 1.2, d / 2 + 0.8),
  };
}

/** Offset local colliders into world space after positioning the group. */
export function offsetColliders(cols: Collider[], wx: number, wy: number, wz: number): Collider[] {
  return cols.map((c) => ({
    min: new THREE.Vector3(c.min.x + wx, c.min.y + wy, c.min.z + wz),
    max: new THREE.Vector3(c.max.x + wx, c.max.y + wy, c.max.z + wz),
    kind: c.kind,
  }));
}

/**
 * Rebuild colliders to match a group placed at (wx,wy,wz) with yaw about Y.
 * - Near 90° snaps: tight AABB (no fattening).
 * - Free angles: segment each box into small world AABBs along its body so
 *   walls stay thin and aligned with the visual instead of one expanded hull.
 */
export function rotateOffsetColliders(
  cols: Collider[],
  wx: number,
  wy: number,
  wz: number,
  yawRad: number,
): Collider[] {
  const twoPi = Math.PI * 2;
  let yaw = yawRad % twoPi;
  if (yaw < 0) yaw += twoPi;
  // Snap if within ~3° of a cardinal angle
  const snapStep = Math.PI / 2;
  const nearest = Math.round(yaw / snapStep) * snapStep;
  const snapped = Math.abs(yaw - nearest) < 0.06 || Math.abs(yaw - nearest + twoPi) < 0.06;
  const useYaw = snapped ? nearest : yawRad;

  const c = Math.cos(useYaw);
  const s = Math.sin(useYaw);
  const rot = (x: number, z: number) => ({ x: x * c + z * s, z: -x * s + z * c });

  const out: Collider[] = [];

  if (snapped) {
    // Axis-aligned after rotation — corner AABB stays tight
    for (const col of cols) {
      const xs = [col.min.x, col.max.x];
      const ys = [col.min.y, col.max.y];
      const zs = [col.min.z, col.max.z];
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;
      for (const x of xs) {
        for (const y of ys) {
          for (const z of zs) {
            const p = rot(x, z);
            const wxp = p.x + wx;
            const wyp = y + wy;
            const wzp = p.z + wz;
            minX = Math.min(minX, wxp);
            maxX = Math.max(maxX, wxp);
            minY = Math.min(minY, wyp);
            maxY = Math.max(maxY, wyp);
            minZ = Math.min(minZ, wzp);
            maxZ = Math.max(maxZ, wzp);
          }
        }
      }
      out.push({
        min: new THREE.Vector3(minX, minY, minZ),
        max: new THREE.Vector3(maxX, maxY, maxZ),
        kind: col.kind,
      });
    }
    return out;
  }

  // Free yaw: sample each collider along its long axes with small cubes
  for (const col of cols) {
    const sx0 = col.min.x;
    const sy0 = col.min.y;
    const sz0 = col.min.z;
    const sx1 = col.max.x;
    const sy1 = col.max.y;
    const sz1 = col.max.z;
    const w = sx1 - sx0;
    const h = sy1 - sy0;
    const d = sz1 - sz0;
    // Target segment size — thinner walls keep thin samples
    const step = Math.min(0.55, Math.max(0.28, Math.min(w, d, h) * 1.2 + 0.2));
    const nx = Math.max(1, Math.ceil(w / step));
    const ny = Math.max(1, Math.ceil(h / step));
    const nz = Math.max(1, Math.ceil(d / step));
    // Cap samples per box for perf
    const maxCells = 48;
    let nxi = nx;
    let nyi = ny;
    let nzi = nz;
    while (nxi * nyi * nzi > maxCells) {
      if (nxi >= nyi && nxi >= nzi && nxi > 1) nxi--;
      else if (nzi >= nyi && nzi > 1) nzi--;
      else if (nyi > 1) nyi--;
      else break;
    }
    const cellHx = (w / nxi) * 0.52 + 0.02;
    const cellHy = (h / nyi) * 0.52 + 0.02;
    const cellHz = (d / nzi) * 0.52 + 0.02;
    // Use isotropic pad in XZ after rotation so cells cover orientation
    const cellR = Math.max(cellHx, cellHz);

    for (let ix = 0; ix < nxi; ix++) {
      for (let iy = 0; iy < nyi; iy++) {
        for (let iz = 0; iz < nzi; iz++) {
          const lx = sx0 + ((ix + 0.5) / nxi) * w;
          const ly = sy0 + ((iy + 0.5) / nyi) * h;
          const lz = sz0 + ((iz + 0.5) / nzi) * d;
          const p = rot(lx, lz);
          const cx = p.x + wx;
          const cy = ly + wy;
          const cz = p.z + wz;
          out.push({
            min: new THREE.Vector3(cx - cellR, cy - cellHy, cz - cellR),
            max: new THREE.Vector3(cx + cellR, cy + cellHy, cz + cellR),
            kind: col.kind,
          });
        }
      }
    }
  }
  return out;
}
