/**
 * Procedural “city section” blueprints for Game Maker.
 * Produces individual placed-object specs so the block stays fully editable.
 */

import type { EditorCategory } from './editorCatalog';

/** Match cityEditor half-story height */
const LAYER_HEIGHT = 1.75;

export interface BlueprintObject {
  category: EditorCategory;
  variant: number;
  /** Local space (section origin at center of block) */
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface CitySectionBlueprint {
  seed: number;
  /** Approx footprint half-extent for ghost bounds */
  halfExtent: number;
  objects: BlueprintObject[];
}

/** Mulberry32 — tiny deterministic PRNG */
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

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function rrange(rng: () => number, a: number, b: number) {
  return a + rng() * (b - a);
}

function obj(
  category: EditorCategory,
  variant: number,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): BlueprintObject {
  return {
    category,
    variant: Math.max(0, Math.min(4, variant | 0)),
    position: [x, y, z],
    rotation: [0, yaw, 0],
    scale: [sx, sy, sz],
  };
}

/**
 * 6 buildings in a loose irregular layout, one path spine + sparse branches,
 * modest platforms, greenery. No rails. Paths kept minimal to avoid double-stacking.
 */
export function generateCitySection(seed: number): CitySectionBlueprint {
  const rng = mulberry32(seed || 1);
  const objects: BlueprintObject[] = [];

  // Irregular column/row bases (not a rigid grid)
  const colBase = [-24, 0, 24];
  const colX = colBase.map((x) => x + rrange(rng, -6, 6));
  const rowZFront = -18 + rrange(rng, -4, 3);
  const rowZBack = 18 + rrange(rng, -3, 4);
  // Occasionally stagger middle column toward/away from spine
  const midNudgeZ = rrange(rng, -5, 5);

  const slots: { x: number; z: number; faceYaw: number; col: number }[] = [
    { x: colX[0]!, z: rowZFront + rrange(rng, -3, 3), faceYaw: 0, col: 0 },
    { x: colX[1]!, z: rowZFront + midNudgeZ * 0.35 + rrange(rng, -2.5, 2.5), faceYaw: 0, col: 1 },
    { x: colX[2]!, z: rowZFront + rrange(rng, -3, 3), faceYaw: 0, col: 2 },
    { x: colX[0]! + rrange(rng, -2, 2), z: rowZBack + rrange(rng, -3, 3), faceYaw: Math.PI, col: 0 },
    { x: colX[1]!, z: rowZBack - midNudgeZ * 0.35 + rrange(rng, -2.5, 2.5), faceYaw: Math.PI, col: 1 },
    { x: colX[2]! + rrange(rng, -2, 2), z: rowZBack + rrange(rng, -3, 3), faceYaw: Math.PI, col: 2 },
  ];

  const elevatedIdx = Math.floor(rng() * 6) % 6;
  const elevLayer = rng() > 0.5 ? 2 : 1;
  const elevY = elevLayer * LAYER_HEIGHT;

  // ——— Path spine: TWO segments only (left + right), no center stack / pad ———
  const spineZ = rrange(rng, -2.5, 2.5);
  const spineY = 0;
  // Path length scale: variant 2 is 24u long; stretch slightly so ends nearly meet
  objects.push(obj('path', 2, -14, spineY, spineZ, Math.PI / 2, 0.95, 1, 1.05));
  objects.push(obj('path', 2, 14, spineY, spineZ, Math.PI / 2, 0.95, 1, 1.05));

  // Only 2–3 buildings get a branch path (others rely on open ground / one short walkway)
  const branchTargets = new Set<number>();
  const branchCount = 2 + Math.floor(rng() * 2); // 2 or 3
  while (branchTargets.size < branchCount) {
    branchTargets.add(Math.floor(rng() * 6) % 6);
  }
  // Elevated building always gets access
  branchTargets.add(elevatedIdx);

  for (let i = 0; i < 6; i++) {
    const s = slots[i]!;
    const isUp = i === elevatedIdx;
    const by = isUp ? elevY : 0;
    const bVar = Math.floor(rng() * 5) % 5;

    // Wide size range — some modest, some huge
    const sizeRoll = rng();
    let sx: number;
    let sy: number;
    let sz: number;
    if (sizeRoll < 0.2) {
      // Compact
      sx = rrange(rng, 0.95, 1.25);
      sy = rrange(rng, 0.9, 1.35);
      sz = rrange(rng, 0.95, 1.25);
    } else if (sizeRoll < 0.75) {
      // Medium–large
      sx = rrange(rng, 1.2, 1.85);
      sy = rrange(rng, 1.15, 2.0);
      sz = rrange(rng, 1.15, 1.8);
    } else {
      // Landmark tower
      sx = rrange(rng, 1.5, 2.25);
      sy = rrange(rng, 1.8, 2.6);
      sz = rrange(rng, 1.4, 2.15);
    }
    // Non-uniform footprint sometimes
    if (rng() > 0.55) {
      sx *= rrange(rng, 0.75, 1.15);
      sz *= rrange(rng, 0.75, 1.2);
    }

    const yawJitter = rrange(rng, -0.35, 0.35);
    const bx = s.x + rrange(rng, -4.5, 4.5);
    const bz = s.z + rrange(rng, -3.5, 3.5);

    // Platforms: often snug, sometimes slightly oversized (not all huge)
    const padRoll = rng();
    let platMul: number;
    if (padRoll < 0.35) platMul = rrange(rng, 1.0, 1.12); // tight under base
    else if (padRoll < 0.75) platMul = rrange(rng, 1.12, 1.28); // modest
    else platMul = rrange(rng, 1.3, 1.45); // room for decor
    const platScale = Math.max(sx, sz) * platMul;
    // Prefer path-adjacent stones (avoid bright turf for most pads)
    const gVar = pick(rng, [0, 0, 1, 2, 3]); // cobble, brass, wood, grate — rare turf
    objects.push(obj('ground', gVar, bx, by, bz, yawJitter * 0.5, platScale, 1, platScale * rrange(rng, 0.9, 1.08)));

    objects.push(
      obj('building', bVar, bx, by, bz, s.faceYaw + yawJitter, sx, sy, sz),
    );

    const branchYaw = s.faceYaw === 0 ? 0 : Math.PI;
    const towardPath = s.faceYaw === 0 ? 1 : -1;

    // Sparse connectors — one piece per branch building, not path+walkway stack
    if (branchTargets.has(i)) {
      const midZ = spineZ * 0.35 + bz * 0.65;
      if (isUp) {
        // Stair is the connector for elevated building (no extra path under it)
        const stairVar = pick(rng, [1, 2, 3]);
        const stairZ = bz - towardPath * (6.5 + rrange(rng, 0, 2));
        objects.push(obj('stair', stairVar, bx + rrange(rng, -1.5, 1.5), spineY, stairZ, branchYaw, 1.0, 1, 1.0));
        if (elevLayer >= 2 && rng() > 0.35) {
          objects.push(
            obj(
              'stair',
              0,
              bx + rrange(rng, -1, 1),
              LAYER_HEIGHT,
              stairZ - towardPath * 2.8,
              branchYaw,
              0.95,
              1,
              0.85,
            ),
          );
        }
      } else if (rng() > 0.4) {
        // Single branch path segment toward building
        objects.push(
          obj(
            'path',
            pick(rng, [0, 0, 3]), // short / curve — avoid long 24u pieces
            bx + rrange(rng, -2, 2),
            spineY,
            midZ,
            branchYaw,
            0.5 + rng() * 0.12,
            1,
            0.55 + rng() * 0.2,
          ),
        );
      } else {
        // Or a single walkway spur (not both)
        objects.push(
          obj(
            'walkway',
            pick(rng, [0, 1, 4]),
            bx + rrange(rng, -1.5, 1.5),
            spineY,
            midZ,
            branchYaw,
            0.85,
            1,
            0.65,
          ),
        );
      }
    }

    // Light decor only when pad is large enough
    if (platMul > 1.2) {
      const rim = platScale * 3.0;
      const decorCount = 1 + Math.floor(rng() * 2);
      for (let d = 0; d < decorCount; d++) {
        const ang = rng() * Math.PI * 2;
        const rad = rim * rrange(rng, 0.38, 0.5);
        const dx = Math.cos(ang) * rad;
        const dz = Math.sin(ang) * rad;
        if (rng() < 0.2) {
          objects.push(
            obj('fountain', Math.floor(rng() * 5) % 5, bx + dx, by, bz + dz, rng() * Math.PI, 0.65, 0.65, 0.65),
          );
        } else {
          objects.push(
            obj(
              'tree',
              pick(rng, [0, 1, 2, 4]),
              bx + dx,
              by,
              bz + dz,
              rng(),
              rrange(rng, 0.85, 1.2),
              rrange(rng, 0.85, 1.15),
              rrange(rng, 0.85, 1.2),
            ),
          );
        }
      }
    } else if (rng() > 0.55) {
      // One bush near small pad
      const ang = rng() * Math.PI * 2;
      const rad = platScale * 2.6;
      objects.push(
        obj(
          'tree',
          pick(rng, [2, 4]),
          bx + Math.cos(ang) * rad,
          by,
          bz + Math.sin(ang) * rad,
          rng(),
          0.9,
          0.9,
          0.9,
        ),
      );
    }

    if (rng() > 0.62) {
      objects.push(
        obj(
          'vehicle',
          Math.floor(rng() * 5) % 5,
          bx + rrange(rng, -5, 5),
          spineY,
          spineZ + towardPath * rrange(rng, -5.5, -3.5),
          rrange(rng, 0, Math.PI * 2),
          rrange(rng, 0.9, 1.15),
          1,
          rrange(rng, 0.9, 1.15),
        ),
      );
    }
  }

  // A few plaza trees off the spine (not on the road)
  const treeN = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < treeN; i++) {
    const side = rng() > 0.5 ? 1 : -1;
    objects.push(
      obj(
        'tree',
        pick(rng, [0, 1, 2]),
        rrange(rng, -30, 30),
        spineY,
        spineZ + side * rrange(rng, 7, 11),
        rng(),
        rrange(rng, 0.95, 1.25),
        rrange(rng, 0.95, 1.2),
        rrange(rng, 0.95, 1.25),
      ),
    );
  }

  return { seed, halfExtent: 48, objects };
}

/** Apply world transform to local blueprint objects */
export function transformBlueprint(
  bp: CitySectionBlueprint,
  origin: { x: number; y: number; z: number },
  yaw: number,
  uniformScale: number,
): BlueprintObject[] {
  const s = Math.max(0.35, Math.min(2.5, uniformScale));
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return bp.objects.map((o) => {
    const lx = o.position[0] * s;
    const ly = o.position[1] * s;
    const lz = o.position[2] * s;
    const wx = origin.x + lx * cos + lz * sin;
    const wz = origin.z - lx * sin + lz * cos;
    const wy = origin.y + ly;
    return {
      category: o.category,
      variant: o.variant,
      position: [wx, wy, wz],
      rotation: [o.rotation[0], o.rotation[1] + yaw, o.rotation[2]],
      scale: [o.scale[0] * s, o.scale[1] * s, o.scale[2] * s],
    };
  });
}

export function newCitySeed(): number {
  return (Math.random() * 0xffffffff) >>> 0 || 1;
}
