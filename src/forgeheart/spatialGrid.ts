/**
 * Uniform XZ spatial hash for collider queries.
 * Streaming inserts/removes by chunkId without full rebuilds when possible.
 */

import type { Collider } from './level';

const keyOf = (cx: number, cz: number) => `${cx},${cz}`;

export class SpatialColliderGrid {
  readonly cellSize: number;
  private cells = new Map<string, Collider[]>();
  /** All colliders currently registered (active stream set). */
  private all: Collider[] = [];
  /** chunkId → colliders owned by that chunk */
  private chunks = new Map<string, Collider[]>();
  /** Scratch query result (reused). */
  private scratch: Collider[] = [];
  private scratchSet = new Set<Collider>();

  queryHits = 0;

  constructor(cellSize = 12) {
    this.cellSize = cellSize;
  }

  get count() {
    return this.all.length;
  }

  clear() {
    this.cells.clear();
    this.all = [];
    this.chunks.clear();
  }

  /** Replace entire world (non-streaming modes). */
  rebuild(colliders: Collider[]) {
    this.clear();
    for (const c of colliders) this.insert(c);
  }

  setChunk(chunkId: string, colliders: Collider[]) {
    this.removeChunk(chunkId);
    if (!colliders.length) return;
    const owned = colliders.slice();
    this.chunks.set(chunkId, owned);
    for (const c of owned) this.insert(c);
  }

  removeChunk(chunkId: string) {
    const owned = this.chunks.get(chunkId);
    if (!owned) return;
    for (const c of owned) this.erase(c);
    this.chunks.delete(chunkId);
  }

  insert(c: Collider) {
    this.all.push(c);
    this.forEachCell(c, (k) => {
      let list = this.cells.get(k);
      if (!list) {
        list = [];
        this.cells.set(k, list);
      }
      list.push(c);
    });
  }

  private erase(c: Collider) {
    const ix = this.all.indexOf(c);
    if (ix >= 0) this.all.splice(ix, 1);
    this.forEachCell(c, (k) => {
      const list = this.cells.get(k);
      if (!list) return;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) this.cells.delete(k);
    });
  }

  private forEachCell(c: Collider, fn: (k: string) => void) {
    const x0 = Math.floor(c.min.x / this.cellSize);
    const x1 = Math.floor(c.max.x / this.cellSize);
    const z0 = Math.floor(c.min.z / this.cellSize);
    const z1 = Math.floor(c.max.z / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        fn(keyOf(cx, cz));
      }
    }
  }

  /**
   * Colliders overlapping the AABB (deduped). Reuses scratch array —
   * do not retain across frames.
   */
  queryAabb(minX: number, minZ: number, maxX: number, maxZ: number): Collider[] {
    this.queryHits++;
    this.scratch.length = 0;
    this.scratchSet.clear();
    const x0 = Math.floor(minX / this.cellSize);
    const x1 = Math.floor(maxX / this.cellSize);
    const z0 = Math.floor(minZ / this.cellSize);
    const z1 = Math.floor(maxZ / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(keyOf(cx, cz));
        if (!list) continue;
        for (const c of list) {
          if (this.scratchSet.has(c)) continue;
          // Quick XZ reject
          if (c.max.x < minX || c.min.x > maxX || c.max.z < minZ || c.min.z > maxZ) continue;
          this.scratchSet.add(c);
          this.scratch.push(c);
        }
      }
    }
    return this.scratch;
  }

  /** Convenience around a point with radius. */
  queryRadius(x: number, z: number, r: number): Collider[] {
    return this.queryAabb(x - r, z - r, x + r, z + r);
  }

  /** Flat list for rare full scans (prefer query*). */
  getAll(): readonly Collider[] {
    return this.all;
  }
}
