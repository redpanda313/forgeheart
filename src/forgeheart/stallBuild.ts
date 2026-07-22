/**
 * Shop/stall site builder — selection box, structure, placeable props.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import { buildEnterableShell, offsetColliders } from './enterableBuilding';
import type { Collider } from './level';
import type { SiteProp, StallLayout, StallTier } from './economy';

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

/** Placeable shop improvements — each instance costs its fee */
export const SHOP_PROP_CATALOG: {
  id: string;
  name: string;
  blurb: string;
  cost: number;
}[] = [
  { id: 'crates', name: 'Crate stacks', blurb: 'Stock piles beside the stand', cost: 40 },
  { id: 'banners', name: 'Banner poles', blurb: 'Bright plaza flags', cost: 40 },
  { id: 'lanterns', name: 'Lantern string', blurb: 'Warm evening light', cost: 45 },
  { id: 'planters', name: 'Planters', blurb: 'Soft greenery', cost: 35 },
  { id: 'signboard', name: 'Signboard', blurb: 'Name your shop', cost: 50 },
  { id: 'display_case', name: 'Display case', blurb: 'Glass frontage', cost: 70 },
  { id: 'flower_cart', name: 'Flower cart', blurb: 'Attract foot traffic', cost: 55 },
  { id: 'extra_awning', name: 'Side awning', blurb: 'Shade for browsers', cost: 80 },
];

export const STALL_COLOR_BASE = 20;
export const STALL_COLOR_STEP = 15;

export function stallTierExtra(tier: StallTier): number {
  return STALL_TIERS.find((t) => t.id === tier)?.extraCost ?? 0;
}

export function stallColorFee(color: number): number {
  const c = Math.max(0, Math.min(STALL_COLORS.length - 1, color));
  if (c === 0) return 0;
  return STALL_COLOR_BASE + c * STALL_COLOR_STEP;
}

export function shopPropCost(id: string): number {
  return SHOP_PROP_CATALOG.find((p) => p.id === id)?.cost ?? 40;
}

export function sumShopPropsCost(props: SiteProp[]): number {
  let n = 0;
  for (const p of props) n += shopPropCost(p.id);
  return n;
}

export function defaultStallLayout(x = 0, z = 0): StallLayout {
  return {
    plotX: x,
    plotZ: z,
    yaw: 0,
    tier: 'bench',
    color: 0,
    props: [],
    built: false,
  };
}

/**
 * Front-door / facing cue on the local +Z edge (rotates with site yaw).
 * Loud visuals for placement; keep userData.doorCue so validity tint skips them.
 */
export function addFrontDoorCue(
  parent: THREE.Group,
  doorZ: number,
  opts?: { doorW?: number; label?: string; y?: number; loud?: boolean },
): THREE.Group {
  const cue = new THREE.Group();
  cue.name = 'FrontDoorCue';
  cue.userData.doorCue = true;
  const doorW = opts?.doorW ?? 2.4;
  const label = opts?.label ?? 'ENTRY';
  const y0 = opts?.y ?? 0.05;
  const loud = opts?.loud !== false;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffc84a,
    emissive: 0xff8800,
    emissiveIntensity: loud ? 1.1 : 0.65,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  const matCyan = new THREE.MeshStandardMaterial({
    color: 0x4af0ff,
    emissive: 0x00aacc,
    emissiveIntensity: loud ? 1.2 : 0.55,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  // Carpet runner from center to door — strongest facing cue
  const runLen = Math.max(2.2, doorZ + 0.4);
  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(1.6, doorW * 0.85), 0.06, runLen),
    matCyan,
  );
  runner.position.set(0, y0 + 0.04, doorZ - runLen / 2 + 0.2);
  runner.userData.doorCue = true;
  cue.add(runner);

  // Chevrons along the runner pointing +Z
  for (let i = 0; i < 3; i++) {
    const chev = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 3), mat);
    chev.rotation.x = Math.PI / 2;
    chev.position.set(0, y0 + 0.2, 0.8 + i * (runLen * 0.28));
    chev.userData.doorCue = true;
    cue.add(chev);
  }

  // Tall door frame
  const postH = loud ? 3.2 : 2.2;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, postH, 0.28), mat);
    post.position.set(sx * (doorW / 2 + 0.1), y0 + postH / 2, doorZ);
    post.userData.doorCue = true;
    cue.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.7, 0.3, 0.3), mat);
  lintel.position.set(0, y0 + postH, doorZ);
  lintel.userData.doorCue = true;
  cue.add(lintel);

  // Big outbound arrow beyond the door
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 1.6), mat);
  shaft.position.set(0, y0 + 0.2, doorZ + 1.1);
  shaft.userData.doorCue = true;
  cue.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 4), mat);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, y0 + 0.25, doorZ + 2.1);
  head.userData.doorCue = true;
  cue.add(head);

  // Floating labels
  const makeLabel = (text: string, y: number, scaleX: number) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(10,8,4,0.88)';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = '#ffe8a0';
    ctx.font = 'bold 48px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    spr.position.set(0, y, doorZ + 0.35);
    spr.scale.set(scaleX, scaleX * 0.22, 1);
    spr.userData.doorCue = true;
    cue.add(spr);
  };
  makeLabel(label, y0 + postH + 1.1, loud ? 4.2 : 2.8);
  if (loud) makeLabel('FRONT →', y0 + postH + 0.45, 3.4);

  parent.add(cue);
  return cue;
}

/** Large empty selection footprint for Game Maker site step */
export function makeSelectionBox(
  size = 14,
  opts?: { doorCue?: boolean; doorLabel?: string },
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'SiteSelectionBox';
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(size, 0.06, size),
    new THREE.MeshStandardMaterial({
      color: 0x66cc88,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  fill.position.y = 0.04;
  g.add(fill);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.2, size)),
    new THREE.LineBasicMaterial({ color: 0xa8ffcc }),
  );
  edges.position.y = 0.12;
  g.add(edges);
  // Corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.4, 0.18),
        new THREE.MeshStandardMaterial({
          color: 0xc4a35a,
          emissive: 0x665522,
          emissiveIntensity: 0.35,
        }),
      );
      post.position.set(sx * (size * 0.48), 0.7, sz * (size * 0.48));
      g.add(post);
    }
  }
  if (opts?.doorCue) {
    // Bright +Z face band so facing reads even before the arch
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.92, 0.14, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0xffb020,
        emissive: 0xff6600,
        emissiveIntensity: 1.15,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    face.position.set(0, 0.16, size * 0.48);
    face.userData.doorCue = true;
    g.add(face);
    addFrontDoorCue(g, size * 0.48, {
      doorW: Math.min(3.6, size * 0.32),
      label: opts.doorLabel ?? 'ENTRY',
      loud: true,
    });
  }
  return g;
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
  interactLocal: THREE.Vector3;
  enterable: boolean;
};

function addShopPropMesh(
  g: THREE.Group,
  id: string,
  lx: number,
  lz: number,
  yaw: number,
  woodM: THREE.Material,
  accentM: THREE.Material,
  clothM: THREE.Material,
) {
  const root = new THREE.Group();
  root.position.set(lx, 0, lz);
  root.rotation.y = yaw;
  if (id === 'crates') {
    root.add(box(woodM, 0.7, 0.55, 0.7, 0, 0.35, 0));
    root.add(box(woodM, 0.55, 0.4, 0.55, 0.35, 0.28, 0.2));
  } else if (id === 'banners') {
    root.add(box(accentM, 0.1, 2.4, 0.1, 0, 1.3, 0));
    root.add(box(clothM, 0.5, 0.7, 0.05, 0, 2.0, 0));
  } else if (id === 'lanterns') {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffe8a0,
        emissive: 0xffcc66,
        emissiveIntensity: 0.7,
      }),
    );
    lamp.position.set(0, 2.0, 0);
    root.add(lamp);
    root.add(box(accentM, 0.06, 1.6, 0.06, 0, 0.9, 0));
  } else if (id === 'planters') {
    root.add(box(new THREE.MeshStandardMaterial({ color: 0x4a6a40 }), 0.6, 0.35, 0.6, 0, 0.25, 0));
  } else if (id === 'signboard') {
    root.add(box(accentM, 1.6, 0.9, 0.08, 0, 1.8, 0));
    root.add(box(woodM, 0.1, 1.6, 0.1, -0.7, 0.9, 0));
    root.add(box(woodM, 0.1, 1.6, 0.1, 0.7, 0.9, 0));
  } else if (id === 'display_case') {
    root.add(box(accentM, 1.4, 1.1, 0.7, 0, 0.7, 0));
    root.add(
      box(
        new THREE.MeshStandardMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.35,
          roughness: 0.2,
        }),
        1.2,
        0.7,
        0.55,
        0,
        0.95,
        0,
      ),
    );
  } else if (id === 'flower_cart') {
    root.add(box(woodM, 1.3, 0.5, 0.8, 0, 0.45, 0));
    root.add(box(new THREE.MeshStandardMaterial({ color: 0xd47898 }), 1.1, 0.35, 0.6, 0, 0.85, 0));
  } else if (id === 'extra_awning') {
    root.add(box(clothM, 2.4, 0.08, 1.6, 0, 2.2, 0));
    root.add(box(accentM, 0.1, 2.0, 0.1, -1.0, 1.1, -0.6));
    root.add(box(accentM, 0.1, 2.0, 0.1, 1.0, 1.1, -0.6));
  } else {
    root.add(box(woodM, 0.5, 0.5, 0.5, 0, 0.3, 0));
  }
  g.add(root);
}

/** Tiny ghost for the active prop tool */
export function makeShopPropGhost(id: string, mats: Mats): THREE.Group {
  const pal = STALL_COLORS[0]!;
  const woodM = new THREE.MeshStandardMaterial({
    color: pal.wood,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const accentM = new THREE.MeshStandardMaterial({
    color: pal.accent,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const clothM = new THREE.MeshStandardMaterial({
    color: pal.cloth,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const g = new THREE.Group();
  addShopPropMesh(g, id, 0, 0, 0, woodM, accentM, clothM);
  void mats;
  return g;
}

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
    const shell = buildEnterableShell('shop', mats, {
      floors: layout.tier === 'large' ? 2 : 1,
      color: pal.wood,
      label: layout.tier === 'large' ? 'YOUR HALL' : 'YOUR SHOP',
    });
    g.add(shell.group);
    cols.push(...shell.colliders);
    g.add(box(woodM, 2.2, 0.85, 0.9, 0, 0.55, 1.6));
    g.add(box(accentM, 2.3, 0.08, 1.0, 0, 1.0, 1.6));
    interactLocal = new THREE.Vector3(0, 1.15, 2.2);
  }

  for (const p of layout.props ?? []) {
    addShopPropMesh(g, p.id, p.lx, p.lz, p.yaw, woodM, accentM, clothM);
  }

  return { group: g, colliders: cols, interactLocal, enterable };
}

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

export { offsetColliders };

/** Legacy décor index → prop list */
export function decorIndexToProps(decor: number): SiteProp[] {
  const ids = ['crates', 'banners', 'lanterns', 'planters', 'signboard'] as const;
  const n = Math.max(0, Math.min(ids.length, decor | 0));
  const out: SiteProp[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: ids[i]!, lx: -2.2 + i * 1.1, lz: -2.4, yaw: 0 });
  }
  return out;
}
