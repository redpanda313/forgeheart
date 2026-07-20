/**
 * Player stall build visuals + cost tables (plot → tier → décor → color).
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import { buildEnterableShell, offsetColliders } from './enterableBuilding';
import type { Collider } from './level';
import type { StallLayout, StallTier } from './economy';

export const STALL_TIERS: {
  id: StallTier;
  name: string;
  blurb: string;
  extraCost: number;
}[] = [
  { id: 'bench', name: 'Bench stand', blurb: 'Simple open counter', extraCost: 0 },
  { id: 'shade', name: 'Shaded stand', blurb: 'Counter + sun canopy', extraCost: 75 },
  { id: 'shop', name: 'Shop hut', blurb: 'Enterable · desk inside', extraCost: 200 },
  { id: 'large', name: 'Market hall', blurb: 'Large enterable shop', extraCost: 450 },
];

export const STALL_DECOR_NAMES = [
  'None',
  'Crate stacks',
  'Banner poles',
  'Lanterns',
  'Planters',
  'Signboard',
] as const;

export const STALL_COLOR_NAMES = [
  'Weathered wood',
  'Market red',
  'Brass trim',
  'Sky teal',
  'Spore green',
  'Night indigo',
] as const;

export const STALL_COLORS = [
  { wood: 0x6a5848, accent: 0xc4a35a, cloth: 0x8a7060 },
  { wood: 0x5a4038, accent: 0xc45a3a, cloth: 0xc45a3a },
  { wood: 0x5a5040, accent: 0xe0c060, cloth: 0xb8923a },
  { wood: 0x4a5560, accent: 0x3ad0f0, cloth: 0x3a8aaa },
  { wood: 0x4a5a48, accent: 0x6acc66, cloth: 0x5a8a58 },
  { wood: 0x3a3a50, accent: 0x8877cc, cloth: 0x4a4068 },
] as const;

export const STALL_DECOR_UNIT = 40;
export const STALL_COLOR_BASE = 20;
export const STALL_COLOR_STEP = 15;

export function stallTierExtra(tier: StallTier): number {
  return STALL_TIERS.find((t) => t.id === tier)?.extraCost ?? 0;
}

export function stallDecorFee(decor: number): number {
  return Math.max(0, Math.min(STALL_DECOR_NAMES.length - 1, decor)) * STALL_DECOR_UNIT;
}

export function stallColorFee(color: number): number {
  const c = Math.max(0, Math.min(STALL_COLORS.length - 1, color));
  if (c === 0) return 0;
  return STALL_COLOR_BASE + c * STALL_COLOR_STEP;
}

export function defaultStallLayout(x = 0, z = 0): StallLayout {
  return {
    plotX: x,
    plotZ: z,
    yaw: 0,
    tier: 'bench',
    decor: 0,
    color: 0,
    built: false,
  };
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

export type StallVisualBuilt = {
  group: THREE.Group;
  colliders: Collider[];
  /** World interact point for stall manage / desk */
  interactLocal: THREE.Vector3;
  enterable: boolean;
};

/** Build stall at local origin (plot center). Caller sets group position/yaw. */
export function buildStallVisual(mats: Mats, layout: StallLayout): StallVisualBuilt {
  const g = new THREE.Group();
  g.name = 'PlayerStallBuild';
  const cols: Collider[] = [];
  const pal = STALL_COLORS[layout.color % STALL_COLORS.length]!;
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
    emissive: new THREE.Color(pal.cloth).multiplyScalar(0.15),
    emissiveIntensity: 0.35,
  });

  // Ground plot
  const plotW = layout.tier === 'large' ? 12 : layout.tier === 'shop' ? 9 : 6.5;
  const plotD = layout.tier === 'large' ? 10 : layout.tier === 'shop' ? 8 : 5.5;
  g.add(box(woodM, plotW, 0.16, plotD, 0, 0.08, 0));
  cols.push({
    min: new THREE.Vector3(-plotW / 2, 0, -plotD / 2),
    max: new THREE.Vector3(plotW / 2, 0.16, plotD / 2),
    kind: 'floor',
  });

  let interactLocal = new THREE.Vector3(0, 1.2, plotD * 0.35);
  let enterable = false;

  if (layout.tier === 'bench' || layout.tier === 'shade') {
    g.add(box(woodM, 3.4, 1.05, 0.75, 0, 0.7, 0.6));
    g.add(box(accentM, 3.6, 0.12, 0.9, 0, 1.25, 0.6));
    if (layout.tier === 'shade') {
      g.add(box(clothM, 4.2, 0.1, 3.4, 0, 2.45, 0.2));
      for (const sx of [-1.8, 1.8]) {
        g.add(box(accentM, 0.12, 2.3, 0.12, sx, 1.25, -1.1));
        g.add(box(accentM, 0.12, 2.3, 0.12, sx, 1.25, 1.2));
      }
    }
    interactLocal = new THREE.Vector3(0, 1.2, 1.4);
  } else {
    enterable = true;
    const kind = layout.tier === 'large' ? 'shop' : 'shop';
    const shell = buildEnterableShell(kind, mats, {
      floors: layout.tier === 'large' ? 2 : 1,
      color: pal.wood,
      label: layout.tier === 'large' ? 'YOUR HALL' : 'YOUR SHOP',
    });
    g.add(shell.group);
    cols.push(...shell.colliders);
    // Counter / desk inside near door
    const desk = box(woodM, 2.2, 0.85, 0.9, 0, 0.55, 1.6);
    g.add(desk);
    const deskTop = box(accentM, 2.3, 0.08, 1.0, 0, 1.0, 1.6);
    g.add(deskTop);
    interactLocal = new THREE.Vector3(0, 1.15, 2.2);
  }

  // Décor layers
  if (layout.decor >= 1) {
    g.add(box(woodM, 0.7, 0.55, 0.7, -plotW * 0.35, 0.4, -plotD * 0.3));
    g.add(box(woodM, 0.55, 0.4, 0.55, -plotW * 0.28, 0.32, -plotD * 0.22));
  }
  if (layout.decor >= 2) {
    for (const sx of [-1, 1]) {
      const pole = box(accentM, 0.1, 2.4, 0.1, sx * plotW * 0.38, 1.3, -plotD * 0.35);
      g.add(pole);
      g.add(box(clothM, 0.5, 0.7, 0.05, sx * plotW * 0.38, 2.0, -plotD * 0.35));
    }
  }
  if (layout.decor >= 3) {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * 1.4;
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        new THREE.MeshStandardMaterial({
          color: 0xffe8a0,
          emissive: 0xffcc66,
          emissiveIntensity: 0.7,
        }),
      );
      lamp.position.set(lx, 2.1, plotD * 0.2);
      g.add(lamp);
    }
  }
  if (layout.decor >= 4) {
    for (const sx of [-1, 1]) {
      g.add(box(new THREE.MeshStandardMaterial({ color: 0x4a6a40 }), 0.6, 0.35, 0.6, sx * 2.2, 0.3, plotD * 0.35));
    }
  }
  if (layout.decor >= 5) {
    g.add(box(accentM, 1.8, 0.9, 0.08, 0, 2.6, -plotD * 0.4));
  }

  return { group: g, colliders: cols, interactLocal, enterable };
}

/** Offset local colliders into world space after positioning the stall group. */
export function worldStallColliders(
  built: StallVisualBuilt,
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

export function rotateLocal(local: THREE.Vector3, yaw: number, wx: number, wz: number): THREE.Vector3 {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return new THREE.Vector3(
    wx + local.x * cos - local.z * sin,
    local.y,
    wz + local.x * sin + local.z * cos,
  );
}

/** Re-export for callers that already import offset helpers */
export { offsetColliders };
