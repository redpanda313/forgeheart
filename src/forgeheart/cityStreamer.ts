/**
 * District / chunk streaming for the mega-city.
 * Keeps a hysteresis ring around the player loaded; unloads distant chunks.
 */

import * as THREE from 'three';
import type { Collider } from './level';
import type { SpatialColliderGrid } from './spatialGrid';

export type StreamChunk = {
  id: string;
  /** World XZ center for distance tests */
  x: number;
  z: number;
  group: THREE.Group;
  colliders: Collider[];
  /** Always keep loaded (skyways hub, apartment, etc.) */
  resident?: boolean;
};

export class CityStreamer {
  loadRadius: number;
  unloadRadius: number;
  private chunks = new Map<string, StreamChunk>();
  private loaded = new Set<string>();
  private grid: SpatialColliderGrid | null = null;

  constructor(loadRadius = 220, unloadRadius = 300) {
    this.loadRadius = loadRadius;
    this.unloadRadius = unloadRadius;
  }

  attachGrid(grid: SpatialColliderGrid) {
    this.grid = grid;
  }

  clear() {
    for (const id of [...this.loaded]) this.unload(id);
    this.chunks.clear();
    this.loaded.clear();
  }

  register(chunk: StreamChunk) {
    this.chunks.set(chunk.id, chunk);
    // Start hidden unless resident — first update will load nearby
    if (chunk.resident) {
      this.load(chunk.id);
    } else {
      chunk.group.visible = false;
    }
  }

  get loadedCount() {
    return this.loaded.size;
  }

  get totalCount() {
    return this.chunks.size;
  }

  update(playerX: number, playerZ: number) {
    for (const [id, chunk] of this.chunks) {
      if (chunk.resident) {
        if (!this.loaded.has(id)) this.load(id);
        continue;
      }
      const d = Math.hypot(chunk.x - playerX, chunk.z - playerZ);
      const isOn = this.loaded.has(id);
      if (!isOn && d <= this.loadRadius) this.load(id);
      else if (isOn && d > this.unloadRadius) this.unload(id);
    }
  }

  private load(id: string) {
    const chunk = this.chunks.get(id);
    if (!chunk || this.loaded.has(id)) return;
    chunk.group.visible = true;
    this.loaded.add(id);
    this.grid?.setChunk(id, chunk.colliders);
  }

  private unload(id: string) {
    const chunk = this.chunks.get(id);
    if (!chunk || chunk.resident || !this.loaded.has(id)) return;
    chunk.group.visible = false;
    this.loaded.delete(id);
    this.grid?.removeChunk(id);
  }

  /** Force everything loaded (Game Maker / map overview). */
  loadAll() {
    for (const id of this.chunks.keys()) this.load(id);
  }
}

/** Simple distant island impostor (flat disc) for unloaded plazas. */
export function makeIslandImpostor(x: number, z: number, size: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(size * 0.55, 10),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.05, z);
  mesh.name = 'island-impostor';
  return mesh;
}
