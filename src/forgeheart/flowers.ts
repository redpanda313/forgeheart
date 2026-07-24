/**
 * Plaza flower patches — personality-slot harvestables.
 * Each patch grows one bloom type; some plazas host two patches.
 */

import * as THREE from 'three';
import { COMMODITIES, PLAZA_FLOWER_POOLS, flowersAtSite } from './economy';
import { FLOWER_IDS, type FlowerId } from './frameAssembly';

export type { FlowerId };

/** Petal / emissive colors per bloom commodity. */
export const FLOWER_COLORS: Record<
  FlowerId,
  { petal: number; emissive: number; stem: number; soil: number }
> = {
  bloom_brass: { petal: 0xd4a84a, emissive: 0x886622, stem: 0x3a5a32, soil: 0x4a3a28 },
  bloom_sky: { petal: 0x7ec8e8, emissive: 0x3366aa, stem: 0x3d6a48, soil: 0x3a4838 },
  bloom_spore: { petal: 0x9a78b8, emissive: 0x553388, stem: 0x4a6840, soil: 0x3a4030 },
  bloom_harbor: { petal: 0xc05070, emissive: 0x882244, stem: 0x3a5a38, soil: 0x3a3428 },
  bloom_aether: { petal: 0x8870c8, emissive: 0x5533aa, stem: 0x3a5848, soil: 0x3a3848 },
  flower_gift: { petal: 0xe8a0c8, emissive: 0x884466, stem: 0x3d5a42, soil: 0x4a3a30 },
};

/** @deprecated Prefer PLAZA_FLOWER_POOLS from economy — kept for call-site compatibility. */
export const PLAZA_FLOWER_PATCHES: Record<string, FlowerId[]> = Object.fromEntries(
  Object.entries(PLAZA_FLOWER_POOLS).map(([k, v]) => [k, [...v]]),
) as Record<string, FlowerId[]>;

/** Fallback when a district id is missing from the table. */
export function flowerPatchesForDistrict(
  districtId: string,
  role?: string,
): FlowerId[] {
  const listed = PLAZA_FLOWER_POOLS[districtId];
  if (listed?.length) return [...listed];
  if (role === 'harbor') return ['bloom_harbor'];
  if (role === 'premium') return ['bloom_aether'];
  if (role === 'industrial') return ['bloom_brass'];
  if (role === 'market') return ['flower_gift'];
  return flowersAtSite(districtId).filter((id): id is FlowerId =>
    (FLOWER_IDS as readonly string[]).includes(id),
  ) as FlowerId[];
}

export function flowerDisplayName(id: FlowerId): string {
  return COMMODITIES[id]?.name ?? id;
}

export function isFlowerId(id: string): id is FlowerId {
  return (FLOWER_IDS as readonly string[]).includes(id);
}

/**
 * Build a small stemmed flower patch (not a ground ball).
 * Several thin stems with petal heads on a soil mound.
 */
export function buildFlowerPatchMesh(
  flowerId: FlowerId,
  opts?: { seed?: number; count?: number; scale?: number },
): THREE.Group {
  const colors = FLOWER_COLORS[flowerId];
  const seed = opts?.seed ?? hashStr(flowerId);
  const count = opts?.count ?? 5;
  const scale = opts?.scale ?? 1;
  const g = new THREE.Group();
  g.name = `FlowerPatch_${flowerId}`;

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85 * scale, 0.95 * scale, 0.18 * scale, 10),
    new THREE.MeshStandardMaterial({
      color: colors.soil,
      roughness: 0.95,
      metalness: 0.05,
    }),
  );
  soil.position.y = 0.09 * scale;
  soil.receiveShadow = true;
  g.add(soil);

  const stemMat = new THREE.MeshStandardMaterial({
    color: colors.stem,
    roughness: 0.85,
    metalness: 0.05,
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: colors.petal,
    emissive: colors.emissive,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.1,
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0xf0e0a0,
    emissive: colors.emissive,
    emissiveIntensity: 0.2,
    roughness: 0.6,
  });

  for (let i = 0; i < count; i++) {
    const t = seeded(seed, i);
    const ang = t * Math.PI * 2;
    const rad = (0.15 + seeded(seed, i + 17) * 0.55) * scale;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const stemH = (0.45 + seeded(seed, i + 31) * 0.35) * scale;
    const lean = (seeded(seed, i + 47) - 0.5) * 0.25;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * scale, 0.045 * scale, stemH, 5),
      stemMat,
    );
    stem.position.set(x, 0.18 * scale + stemH / 2, z);
    stem.rotation.z = lean;
    stem.rotation.x = (seeded(seed, i + 61) - 0.5) * 0.2;
    stem.castShadow = true;
    g.add(stem);

    const headY = 0.18 * scale + stemH + lean * 0.1;
    const bloom = new THREE.Group();
    bloom.position.set(x + lean * stemH * 0.35, headY, z);

    // Simple 5-petal head
    const petalR = (0.1 + seeded(seed, i + 71) * 0.04) * scale;
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(petalR, 6, 5),
        petalMat,
      );
      petal.position.set(Math.cos(pa) * petalR * 0.85, 0.02 * scale, Math.sin(pa) * petalR * 0.85);
      petal.scale.set(1, 0.55, 1);
      bloom.add(petal);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(petalR * 0.45, 6, 5),
      centerMat,
    );
    center.position.y = 0.03 * scale;
    bloom.add(center);
    g.add(bloom);
  }

  // Tiny leaf accents at the base of a couple stems
  const leafMat = new THREE.MeshStandardMaterial({
    color: colors.stem,
    roughness: 0.9,
  });
  for (let i = 0; i < 2; i++) {
    const t = seeded(seed, i + 90);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 5, 4), leafMat);
    leaf.scale.set(1.4, 0.35, 0.7);
    leaf.position.set(
      (t - 0.5) * 0.7 * scale,
      0.22 * scale,
      (seeded(seed, i + 99) - 0.5) * 0.7 * scale,
    );
    leaf.rotation.y = t * Math.PI;
    g.add(leaf);
  }

  return g;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from seed + salt. */
function seeded(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
