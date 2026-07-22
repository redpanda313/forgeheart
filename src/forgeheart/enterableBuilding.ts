/**
 * Lightweight enterable building shells for sky-city plazas.
 * Adapted from floatingCity buildBuilding (home / shop) with world-space colliders.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { Collider } from './level';

export type EnterableKind = 'home' | 'shop' | 'office';

export type EnterableBuilt = {
  group: THREE.Group;
  colliders: Collider[];
  /** World-space point just inside the door */
  interiorSpot: THREE.Vector3;
  doorWorld: THREE.Vector3;
};

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
 * Caller positions `group` at (wx, 0, wz) and offsets colliders accordingly.
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
  const floorH = kind === 'home' ? 2.85 : 3.0;

  for (let f = 0; f < floors; f++) {
    const y0 = f * floorH + 0.12;
    addBox(g, cols, floorMat, w, 0.22, d, 0, y0, 0, 'floor');
    const wh = floorH - 0.2;
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
  // Roof
  addBox(g, cols, mats.copper ?? mats.brass, w + 0.4, 0.28, d + 0.4, 0, floors * floorH + 0.2, 0, 'floor');

  if (opts?.label) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(20,16,12,0.75)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#f0e0b0';
    ctx.font = 'bold 22px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label.slice(0, 18), 128, 32);
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    spr.position.set(0, floors * floorH + 1.2, d / 2 + 0.2);
    spr.scale.set(3.2, 0.8, 1);
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
