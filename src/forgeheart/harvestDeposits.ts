/**
 * Deterministic mineral deposit layouts for harvest reefs.
 * Same site id + mats always yields the same rock/geode placement.
 */

import * as THREE from 'three';
import type { CommodityId } from './economy';
import { DEFAULT_HARVEST_POOL } from './economy';

export interface MatVisual {
  rock: number;
  geode: number;
  emissive: number;
  label: string;
}

/** Visual identity for each harvestable ore. */
export const MAT_VISUALS: Partial<Record<CommodityId, MatVisual>> = {
  cloud_iron: {
    rock: 0x5a6670,
    geode: 0x9ec4e8,
    emissive: 0x3a6a9a,
    label: 'Cloud Iron Geode',
  },
  scrap_brass: {
    rock: 0x5a4830,
    geode: 0xe0b24a,
    emissive: 0x886018,
    label: 'Brass Geode',
  },
  spore_silk: {
    rock: 0x3a4a38,
    geode: 0x7ad4a0,
    emissive: 0x2a7a48,
    label: 'Spore Crystal',
  },
  sky_salt: {
    rock: 0x6a6a72,
    geode: 0xf0f4ff,
    emissive: 0x8899bb,
    label: 'Salt Prism',
  },
};

export interface DepositSpot {
  mat: CommodityId;
  /** Offset from reef center (XZ) */
  ox: number;
  oz: number;
  scale: number;
  yaw: number;
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable layout for a reef. Training and each city district keep the same rocks forever.
 */
export function depositLayoutForSite(
  siteId: string,
  mats: readonly CommodityId[] = DEFAULT_HARVEST_POOL,
  radius = 4.2,
): DepositSpot[] {
  const pool = mats.length ? [...mats] : [...DEFAULT_HARVEST_POOL];
  const rng = mulberry32(hashStr(`reef:${siteId}:${pool.join(',')}`));
  const n = pool.length;
  // Shuffle order deterministically so arrangement varies by site
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  // Base angles with a site-specific spin
  const spin = rng() * Math.PI * 2;
  return order.map((mat, i) => {
    const ang = spin + (i / Math.max(1, n)) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const r = radius * (0.72 + rng() * 0.38);
    return {
      mat,
      ox: Math.cos(ang) * r,
      oz: Math.sin(ang) * r,
      scale: 0.85 + rng() * 0.45,
      yaw: rng() * Math.PI * 2,
    };
  });
}

/**
 * Rock shell with a colored geode crystal — unique per material.
 */
export function buildMineralDepositMesh(mat: CommodityId, seed = 1): THREE.Group {
  const vis = MAT_VISUALS[mat] ?? {
    rock: 0x666666,
    geode: 0xaaaaaa,
    emissive: 0x444444,
    label: String(mat),
  };
  const rng = mulberry32(hashStr(`deposit:${mat}:${seed}`));
  const g = new THREE.Group();
  g.name = `MineralDeposit_${mat}`;

  const rockMat = new THREE.MeshStandardMaterial({
    color: vis.rock,
    metalness: 0.35,
    roughness: 0.72,
  });
  const geodeMat = new THREE.MeshStandardMaterial({
    color: vis.geode,
    metalness: 0.55,
    roughness: 0.28,
    emissive: new THREE.Color(vis.emissive),
    emissiveIntensity: 0.55,
  });

  // Main rock body
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rockMat);
  body.scale.set(1 + rng() * 0.2, 0.75 + rng() * 0.35, 1 + rng() * 0.2);
  body.position.y = 0.45;
  body.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.3);
  body.castShadow = true;
  g.add(body);

  // Secondary chunks
  for (let i = 0; i < 2; i++) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), rockMat);
    const a = rng() * Math.PI * 2;
    chunk.position.set(Math.cos(a) * 0.45, 0.25 + rng() * 0.15, Math.sin(a) * 0.45);
    chunk.scale.setScalar(0.7 + rng() * 0.4);
    chunk.rotation.set(rng(), rng(), rng());
    g.add(chunk);
  }

  // Colored geode / mineral heart
  const geode = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), geodeMat);
  geode.position.set((rng() - 0.5) * 0.15, 0.72 + rng() * 0.12, (rng() - 0.5) * 0.15);
  geode.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.4);
  geode.scale.set(0.85 + rng() * 0.3, 1.1 + rng() * 0.35, 0.85 + rng() * 0.3);
  g.add(geode);

  // Small crystal facets
  for (let i = 0; i < 3; i++) {
    const facet = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), geodeMat.clone());
    const a = (i / 3) * Math.PI * 2 + rng();
    facet.position.set(Math.cos(a) * 0.38, 0.55 + rng() * 0.2, Math.sin(a) * 0.38);
    facet.rotation.set(rng(), rng(), rng());
    facet.scale.setScalar(0.6 + rng() * 0.5);
    g.add(facet);
  }

  return g;
}
