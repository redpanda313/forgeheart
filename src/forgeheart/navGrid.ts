/**
 * Grid A* pathfinding for hub workers / future city agents.
 * Rebuilds from solid colliders so walls and Game Maker props block routes.
 */

import * as THREE from 'three';
import type { Collider } from './level';

export interface NavBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const DEFAULT_BOUNDS: NavBounds = {
  minX: -55,
  maxX: 40,
  minZ: -55,
  maxZ: 45,
};

export class NavGrid {
  cellSize: number;
  private bounds: NavBounds;
  private cols = 0;
  private rows = 0;
  /** true = blocked */
  private blocked: Uint8Array = new Uint8Array(0);
  private agentR: number;

  constructor(cellSize = 1.25, agentRadius = 0.45) {
    this.cellSize = cellSize;
    this.agentR = agentRadius;
    this.bounds = { ...DEFAULT_BOUNDS };
  }

  /** Full rebuild from solid colliders (floors ignored for blocking). */
  rebuild(colliders: Collider[], bounds?: Partial<NavBounds>) {
    this.bounds = { ...DEFAULT_BOUNDS, ...bounds };
    const { minX, maxX, minZ, maxZ } = this.bounds;
    this.cols = Math.max(4, Math.ceil((maxX - minX) / this.cellSize));
    this.rows = Math.max(4, Math.ceil((maxZ - minZ) / this.cellSize));
    this.blocked = new Uint8Array(this.cols * this.rows);

    const pad = this.agentR + 0.15;
    for (const c of colliders) {
      if (c.kind === 'floor') continue;
      // Treat unmarked tall boxes as solid walls
      const h = c.max.y - c.min.y;
      if (c.kind !== 'solid' && h <= 0.55) continue;
      if (c.max.y < 0.35) continue; // under floor

      const x0 = Math.floor((c.min.x - pad - minX) / this.cellSize);
      const x1 = Math.floor((c.max.x + pad - minX) / this.cellSize);
      const z0 = Math.floor((c.min.z - pad - minZ) / this.cellSize);
      const z1 = Math.floor((c.max.z + pad - minZ) / this.cellSize);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || z < 0 || x >= this.cols || z >= this.rows) continue;
          this.blocked[z * this.cols + x] = 1;
        }
      }
    }
  }

  private worldToCell(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.floor((x - this.bounds.minX) / this.cellSize);
    const cz = Math.floor((z - this.bounds.minZ) / this.cellSize);
    return {
      cx: THREE.MathUtils.clamp(cx, 0, this.cols - 1),
      cz: THREE.MathUtils.clamp(cz, 0, this.rows - 1),
    };
  }

  private cellCenter(cx: number, cz: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.bounds.minX + (cx + 0.5) * this.cellSize,
      0,
      this.bounds.minZ + (cz + 0.5) * this.cellSize,
    );
  }

  private idx(cx: number, cz: number) {
    return cz * this.cols + cx;
  }

  private isBlocked(cx: number, cz: number) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return true;
    return this.blocked[this.idx(cx, cz)] === 1;
  }

  /** Nearest walkable cell center to world pos */
  snapWalkable(pos: THREE.Vector3): THREE.Vector3 {
    let { cx, cz } = this.worldToCell(pos.x, pos.z);
    if (!this.isBlocked(cx, cz)) return this.cellCenter(cx, cz);
    // Spiral search
    for (let r = 1; r < 24; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.isBlocked(nx, nz)) return this.cellCenter(nx, nz);
        }
      }
    }
    return pos.clone().setY(0);
  }

  /** Straight-line clear of solids (segment vs expanded AABBs approximated via grid). */
  lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(2, Math.ceil(dist / (this.cellSize * 0.45)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const { cx, cz } = this.worldToCell(x, z);
      if (this.isBlocked(cx, cz)) return false;
    }
    return true;
  }

  /**
   * A* path of world points (y=0). Always includes start≈from and end≈to snapped.
   * Empty grid / no path → direct line fallback of two points.
   */
  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    if (this.cols < 1 || this.rows < 1) {
      return [from.clone().setY(0), to.clone().setY(0)];
    }

    const start = this.snapWalkable(from);
    const goal = this.snapWalkable(to);

    if (this.lineClear(start.x, start.z, goal.x, goal.z)) {
      return [start, goal];
    }

    const s = this.worldToCell(start.x, start.z);
    const g = this.worldToCell(goal.x, goal.z);
    if (this.isBlocked(s.cx, s.cz) || this.isBlocked(g.cx, g.cz)) {
      return [start, goal];
    }

    const open: number[] = [];
    const came = new Int32Array(this.cols * this.rows).fill(-1);
    const gScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const fScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const closed = new Uint8Array(this.cols * this.rows);

    const sIdx = this.idx(s.cx, s.cz);
    const gIdx = this.idx(g.cx, g.cz);
    gScore[sIdx] = 0;
    fScore[sIdx] = heuristic(s.cx, s.cz, g.cx, g.cz);
    open.push(sIdx);

    const neighbors = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.414],
      [1, -1, 1.414],
      [-1, 1, 1.414],
      [-1, -1, 1.414],
    ] as const;

    let found = false;
    let guard = 0;
    const maxIter = this.cols * this.rows * 2;

    while (open.length && guard++ < maxIter) {
      // pop lowest f
      let bestI = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]!] < fScore[open[bestI]!]) bestI = i;
      }
      const current = open[bestI]!;
      open[bestI] = open[open.length - 1]!;
      open.pop();

      if (current === gIdx) {
        found = true;
        break;
      }
      if (closed[current]) continue;
      closed[current] = 1;

      const cx = current % this.cols;
      const cz = (current / this.cols) | 0;

      for (const [dx, dz, cost] of neighbors) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (this.isBlocked(nx, nz)) continue;
        // Prevent diagonal corner-cutting through walls
        if (dx !== 0 && dz !== 0) {
          if (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz)) continue;
        }
        const nIdx = this.idx(nx, nz);
        if (closed[nIdx]) continue;
        const tent = gScore[current]! + cost;
        if (tent >= gScore[nIdx]!) continue;
        came[nIdx] = current;
        gScore[nIdx] = tent;
        fScore[nIdx] = tent + heuristic(nx, nz, g.cx, g.cz);
        open.push(nIdx);
      }
    }

    if (!found) {
      return [start, goal];
    }

    // Reconstruct
    const cells: { cx: number; cz: number }[] = [];
    let cur = gIdx;
    while (cur !== -1) {
      cells.push({ cx: cur % this.cols, cz: (cur / this.cols) | 0 });
      cur = came[cur]!;
      if (cells.length > this.cols * this.rows) break;
    }
    cells.reverse();

    const pts: THREE.Vector3[] = [start.clone()];
    for (const c of cells) {
      const p = this.cellCenter(c.cx, c.cz);
      const last = pts[pts.length - 1]!;
      if (last.distanceToSquared(p) > 0.01) pts.push(p);
    }
    const end = goal.clone();
    const last = pts[pts.length - 1]!;
    if (last.distanceToSquared(end) > 0.01) pts.push(end);

    return smoothPath(pts, (a, b) => this.lineClear(a.x, a.z, b.x, b.z));
  }
}

function heuristic(ax: number, az: number, bx: number, bz: number) {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
}

/** String-pull: drop intermediate points when line is clear */
function smoothPath(
  pts: THREE.Vector3[],
  clear: (a: THREE.Vector3, b: THREE.Vector3) => boolean,
): THREE.Vector3[] {
  if (pts.length <= 2) return pts;
  const out: THREE.Vector3[] = [pts[0]!.clone()];
  let i = 0;
  while (i < pts.length - 1) {
    let best = i + 1;
    for (let j = pts.length - 1; j > i + 1; j--) {
      if (clear(pts[i]!, pts[j]!)) {
        best = j;
        break;
      }
    }
    out.push(pts[best]!.clone());
    i = best;
  }
  return out;
}

/** World AABB for owned bay build zone by level */
export function getBayBuildBounds(bayLevel: number): {
  min: THREE.Vector3;
  max: THREE.Vector3;
} | null {
  if (bayLevel < 1) return null;
  // L1 starter pad at (0,-36) r≈9
  let minX = -10;
  let maxX = 10;
  let minZ = -46;
  let maxZ = -26;
  if (bayLevel >= 2) {
    minX = -22; // expanded pad west
    maxZ = -24;
  }
  if (bayLevel >= 3) {
    maxX = 20; // workshop wing east
    minZ = -50;
  }
  return {
    min: new THREE.Vector3(minX, -2, minZ),
    max: new THREE.Vector3(maxX, 24, maxZ),
  };
}

export function pointInBayBounds(
  p: THREE.Vector3,
  bayLevel: number,
): boolean {
  const b = getBayBuildBounds(bayLevel);
  if (!b) return false;
  return (
    p.x >= b.min.x &&
    p.x <= b.max.x &&
    p.z >= b.min.z &&
    p.z <= b.max.z
  );
}
