/**
 * Game Maker / city editor — place, transform, save objects.
 * Works on any level; race props feed rails/ramps/bumps when playing.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { RaceRail, RaceRamp } from './raceway';
import {
  type EditorCategory,
  type CatalogEntry,
  CATALOG,
  CATEGORY_LABELS,
  ALL_CATEGORIES,
} from './editorCatalog';
import {
  buildPathNetwork,
  segmentFromObject,
  isNetworkCategory,
  type NetworkBuildResult,
} from './pathNetwork';

const SAVE_KEY = 'forgeheart-city-editor-v1';

export interface PlacedData {
  id: string;
  category: EditorCategory;
  variant: number;
  position: [number, number, number];
  rotation: [number, number, number]; // euler XYZ radians
  scale: [number, number, number];
}

export interface CitySave {
  version: 1;
  /** Hide procedural race decoration when true */
  clearGenerated: boolean;
  objects: PlacedData[];
}

export interface EditorObject {
  data: PlacedData;
  root: THREE.Group;
  /** For selection raycast */
  pickMeshes: THREE.Object3D[];
}

function uid() {
  return `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCitySave(): CitySave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { version: 1, clearGenerated: false, objects: [] };
    const data = JSON.parse(raw) as CitySave;
    if (!data || data.version !== 1) return { version: 1, clearGenerated: false, objects: [] };
    return {
      version: 1,
      clearGenerated: !!data.clearGenerated,
      objects: Array.isArray(data.objects) ? data.objects : [],
    };
  } catch {
    return { version: 1, clearGenerated: false, objects: [] };
  }
}

export function saveCitySave(save: CitySave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

/** Build Three mesh for a catalog entry */
export function buildPrefab(entry: CatalogEntry, mats: Mats): THREE.Group {
  const g = new THREE.Group();
  g.name = `${entry.category}_${entry.variant}`;
  const v = entry.variant;

  switch (entry.category) {
    case 'building': {
      const colors = [0xb8923a, 0x5a6068, 0xd45d9a, 0xc4a35a, 0x6a5538];
      const h = 5 + v * 1.4;
      const w = 2.8 + (v % 3) * 0.5;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.45, roughness: 0.45 }),
      );
      body.position.y = h / 2;
      body.castShadow = true;
      g.add(body);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.1, 0.3, w * 1.1),
        mats.brass,
      );
      roof.position.y = h + 0.15;
      g.add(roof);
      if (v === 3) {
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 2.2, 8), mats.copper);
        spire.position.y = h + 1.3;
        g.add(spire);
      }
      break;
    }
    case 'walkway': {
      const lens = [8, 16, 12, 14, 10];
      const wids = [3, 3, 3.5, 5, 3.2];
      const len = lens[v]!;
      const wid = wids[v]!;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(wid, 0.28, len),
        new THREE.MeshStandardMaterial({
          // Warm stone / grate — same family as race path (no leaf green)
          color: v === 2 ? 0x555860 : 0x6a5f4e,
          metalness: 0.35,
          roughness: 0.55,
        }),
      );
      deck.position.y = 0.14;
      deck.receiveShadow = true;
      g.add(deck);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, len), mats.iron);
        rail.position.set((wid / 2) * s, 0.4, 0);
        g.add(rail);
      }
      break;
    }
    case 'rail': {
      const lens = [12, 20, 32, 8, 16];
      const elev = v === 4 ? 1.2 : 0.75;
      const len = lens[v]!;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.22, len),
        new THREE.MeshStandardMaterial({
          color: 0xe8f0ff,
          metalness: 0.9,
          roughness: 0.2,
          emissive: 0xffcc33,
          emissiveIntensity: 0.45,
        }),
      );
      bar.position.y = elev;
      g.add(bar);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.06, len * 0.98),
        new THREE.MeshStandardMaterial({
          color: 0xffee66,
          emissive: 0xffaa00,
          emissiveIntensity: 0.95,
        }),
      );
      strip.position.y = elev + 0.14;
      g.add(strip);
      break;
    }
    case 'stair': {
      const steps = [5, 7, 9, 6, 4][v]!;
      const stepH = [0.35, 0.4, 0.55, 0.35, 0.5][v]!;
      const stepD = 1.1;
      const wid = [6, 6, 5, 9, 7][v]!;
      for (let s = 0; s < steps; s++) {
        const h = stepH * (s + 1);
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(wid, h, stepD),
          new THREE.MeshStandardMaterial({ color: 0x8a7a5a, metalness: 0.35, roughness: 0.55 }),
        );
        slab.position.set(0, h / 2, s * stepD);
        g.add(slab);
      }
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(wid + 0.2, 0.15, 0.35),
        new THREE.MeshStandardMaterial({
          color: 0x66e0ff,
          emissive: 0x22aaff,
          emissiveIntensity: 0.7,
        }),
      );
      lip.position.set(0, steps * stepH + 0.1, steps * stepD - 0.3);
      g.add(lip);
      break;
    }
    case 'fountain': {
      const basinR = [2.2, 1.8, 2.5, 3.2, 1.6][v]!;
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(basinR, basinR + 0.3, 0.55, 14),
        mats.brass,
      );
      basin.position.y = 0.3;
      g.add(basin);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(basinR * 0.85, basinR * 0.85, 0.2, 14),
        new THREE.MeshStandardMaterial({
          color: 0x4ec8ff,
          transparent: true,
          opacity: 0.7,
          metalness: 0.2,
          roughness: 0.15,
        }),
      );
      water.position.y = 0.55;
      g.add(water);
      // Rising blue jet + falling curtain (running water)
      const jetH = [2.8, 4.2, 3.2, 2.2, 5.0][v]!;
      const jet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.35, jetH, 8),
        new THREE.MeshStandardMaterial({
          color: 0x66d8ff,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          emissive: 0x2288cc,
          emissiveIntensity: 0.35,
        }),
      );
      jet.position.y = 0.55 + jetH / 2;
      jet.name = 'fountainWater';
      g.add(jet);
      const curtain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.45, jetH * 0.7, 10, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x88ddff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      curtain.position.y = 0.55 + jetH * 0.35;
      curtain.name = 'fountainWater';
      g.add(curtain);
      break;
    }
    case 'fog': {
      const sizes = [12, 16, 20, 14, 18][v]!;
      const fogBall = new THREE.Mesh(
        new THREE.SphereGeometry(sizes / 2, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xaabbcc,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      fogBall.position.y = sizes / 4;
      g.add(fogBall);
      // Editor marker pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), mats.iron);
      pole.position.y = 1.5;
      g.add(pole);
      break;
    }
    case 'vehicle': {
      const colors = [0xe05050, 0x4a80c0, 0xb8923a, 0x5a6068, 0xc47830];
      const truck = v === 1 || v === 3;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(truck ? 2.2 : 1.6, truck ? 1.4 : 0.9, truck ? 4.5 : 3.2),
        new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.55, roughness: 0.4 }),
      );
      body.position.y = truck ? 0.9 : 0.7;
      g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.2), mats.glass);
      cab.position.set(0, truck ? 1.5 : 1.2, 0.6);
      g.add(cab);
      break;
    }
    case 'tree': {
      if (v === 2 || v === 3 || v === 4) {
        // bush / hedge / flowers
        const h = v === 3 ? 1.2 : 0.7;
        const w = v === 3 ? 3 : 1.4;
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(w * 0.45, 8, 6),
          new THREE.MeshStandardMaterial({
            color: v === 4 ? 0xb06070 : 0x3d5a42,
            roughness: 0.9,
          }),
        );
        bush.position.y = h;
        bush.scale.y = v === 3 ? 0.6 : 0.75;
        g.add(bush);
        if (v === 3) {
          const hedge = new THREE.Mesh(
            new THREE.BoxGeometry(4, 1.1, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x3a5240, roughness: 0.9 }),
          );
          hedge.position.y = 0.55;
          g.add(hedge);
        }
      } else {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.32, v === 1 ? 3.2 : 2.2, 6),
          mats.wood,
        );
        trunk.position.y = v === 1 ? 1.6 : 1.2;
        g.add(trunk);
        const canopy = new THREE.Mesh(
          new THREE.SphereGeometry(v === 1 ? 1.1 : 1.5, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x3d5a42, roughness: 0.85 }),
        );
        canopy.position.y = v === 1 ? 3.6 : 2.9;
        canopy.scale.y = v === 1 ? 1.3 : 0.75;
        g.add(canopy);
      }
      break;
    }
    case 'ground': {
      // Varied floating platform decks: rect, circle, octagon, hex, diamond
      const colors = [0x5a5348, 0x6a5f4e, 0x63584a, 0x555860, 0x4a5a48];
      const r = 4.2;
      let deck: THREE.Mesh;
      if (v === 0) {
        deck = new THREE.Mesh(new THREE.BoxGeometry(r * 1.7, 0.35, r * 1.35), new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.25, roughness: 0.65 }));
      } else if (v === 1) {
        deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.35, 28), new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.3, roughness: 0.6 }));
      } else if (v === 2) {
        deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.35, 8), new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.3, roughness: 0.6 }));
      } else if (v === 3) {
        deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.35, 6), new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.35, roughness: 0.55 }));
      } else {
        deck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.35, 4), new THREE.MeshStandardMaterial({ color: colors[v]!, metalness: 0.25, roughness: 0.65 }));
      }
      deck.position.y = 0.15;
      deck.receiveShadow = true;
      deck.castShadow = true;
      g.add(deck);
      // Underside energy dome (visual; pulse handled if tagged in floating city)
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: 0x4a80a0,
          emissive: 0x2288cc,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
      );
      dome.rotation.x = Math.PI;
      dome.position.y = -0.1;
      dome.name = 'domePulse';
      g.add(dome);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.35, 0.04, 6, 20),
        new THREE.MeshStandardMaterial({
          color: 0x66d8ff,
          emissive: 0x2288ff,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.5,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.45;
      ring.name = 'energyRing_0';
      g.add(ring);
      break;
    }
    case 'path': {
      const lens = [10, 16, 24, 12, 10];
      const len = lens[v]!;
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.35, len),
        new THREE.MeshStandardMaterial({ color: 0x5a5348, metalness: 0.2, roughness: 0.7 }),
      );
      road.position.y = 0.18;
      road.receiveShadow = true;
      g.add(road);
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.05, len * 0.5),
        new THREE.MeshStandardMaterial({ color: 0xf0e8c8 }),
      );
      line.position.y = 0.38;
      g.add(line);
      if (v === 4) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(4, 0.12, 8, 24),
          new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2288aa, emissiveIntensity: 0.4 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.4;
        g.add(ring);
      }
      break;
    }
  }

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

/** Half-story vertical grid for Game Maker (≈½ floor). */
export const LAYER_HEIGHT = 1.75;

export type ScaleAxis = 'uniform' | 'horizontal' | 'vertical';

export function yToLayer(y: number): number {
  return Math.round(y / LAYER_HEIGHT);
}

export function layerToY(layer: number): number {
  return layer * LAYER_HEIGHT;
}

export function snapYToLayer(y: number): number {
  return layerToY(yToLayer(y));
}

export class CityEditor {
  group = new THREE.Group();
  objects: EditorObject[] = [];
  clearGenerated = false;
  selectedId: string | null = null;
  private mats: Mats;
  private outline: THREE.BoxHelper | null = null;
  private ghost: THREE.Group | null = null;
  private ghostEntry: CatalogEntry | null = null;
  /** Amber helpers for other objects on the active layer */
  private layerHelpers: THREE.BoxHelper[] = [];
  /** Smooth connected path/rail mesh overlay */
  private networkGroup = new THREE.Group();
  private networkResult: NetworkBuildResult | null = null;
  private networkDirty = true;

  /** Active palette selection for placement */
  activeCategory: EditorCategory = 'building';
  activeVariant = 0;

  constructor(mats: Mats) {
    this.mats = mats;
    this.group.name = 'CityEditorRoot';
    this.networkGroup.name = 'PathNetworkRoot';
    this.group.add(this.networkGroup);
  }

  loadFromStorage() {
    const save = loadCitySave();
    this.clearGenerated = save.clearGenerated;
    this.clearObjects();
    for (const d of save.objects) this.spawnFromData(d, false);
    this.rebuildNetwork();
  }

  persist() {
    saveCitySave({
      version: 1,
      clearGenerated: this.clearGenerated,
      objects: this.objects.map((o) => this.captureData(o)),
    });
  }

  clearObjects() {
    for (const o of this.objects) this.group.remove(o.root);
    this.objects = [];
    this.selectedId = null;
    this.clearOutline();
    this.clearLayerHighlights();
    this.clearNetworkMesh();
  }

  /** Wipe all placed objects + mark generated city for hide */
  eraseAll(includingGenerated: boolean) {
    this.clearObjects();
    if (includingGenerated) this.clearGenerated = true;
    this.persist();
    this.rebuildNetwork();
  }

  setClearGenerated(v: boolean) {
    this.clearGenerated = v;
    this.persist();
  }

  restoreGenerated() {
    this.clearGenerated = false;
    this.persist();
  }

  private captureData(o: EditorObject): PlacedData {
    return {
      id: o.data.id,
      category: o.data.category,
      variant: o.data.variant,
      position: [o.root.position.x, o.root.position.y, o.root.position.z],
      rotation: [o.root.rotation.x, o.root.rotation.y, o.root.rotation.z],
      scale: [o.root.scale.x, o.root.scale.y, o.root.scale.z],
    };
  }

  private spawnFromData(data: PlacedData, select: boolean): EditorObject | null {
    const entry =
      CATALOG.find((c) => c.category === data.category && c.variant === data.variant) ??
      CATALOG.find((c) => c.category === data.category);
    if (!entry) return null;
    const root = buildPrefab(entry, this.mats);
    root.position.set(...data.position);
    root.rotation.set(...data.rotation);
    root.scale.set(...data.scale);
    root.userData.editorId = data.id;
    const pick: THREE.Object3D[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) pick.push(o);
    });
    const obj: EditorObject = { data: { ...data }, root, pickMeshes: pick };
    this.objects.push(obj);
    this.group.add(root);
    if (select) this.select(data.id);
    return obj;
  }

  placeAt(pos: THREE.Vector3, yaw: number, select = true): EditorObject | null {
    const entry =
      CATALOG.find((c) => c.category === this.activeCategory && c.variant === this.activeVariant) ??
      catalogFallback(this.activeCategory);
    if (!entry) return null;
    const snapped = pos.clone();
    snapped.y = snapYToLayer(pos.y);
    const data: PlacedData = {
      id: uid(),
      category: entry.category,
      variant: entry.variant,
      position: [snapped.x, snapped.y, snapped.z],
      rotation: [0, yaw, 0],
      scale: [entry.defaultScale, entry.defaultScale, entry.defaultScale],
    };
    const obj = this.spawnFromData(data, select);
    this.persist();
    if (obj) this.highlightLayer(yToLayer(obj.root.position.y), obj.data.id);
    this.markNetworkDirty();
    return obj;
  }

  /**
   * Spawn many objects at once (city section, etc.). Rebuilds network once.
   * Returns count placed.
   */
  placeMany(
    items: {
      category: EditorCategory;
      variant: number;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }[],
  ): number {
    let n = 0;
    for (const it of items) {
      const data: PlacedData = {
        id: uid(),
        category: it.category,
        variant: it.variant,
        position: [...it.position],
        rotation: [...it.rotation],
        scale: [...it.scale],
      };
      if (this.spawnFromData(data, false)) n++;
    }
    this.persist();
    this.markNetworkDirty();
    return n;
  }

  /** Build a translucent preview group from blueprint objects (not saved). */
  buildPreviewGroup(
    items: {
      category: EditorCategory;
      variant: number;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }[],
  ): THREE.Group {
    const root = new THREE.Group();
    root.name = 'CitySectionPreview';
    for (const it of items) {
      const entry =
        CATALOG.find((c) => c.category === it.category && c.variant === it.variant) ??
        catalogFallback(it.category);
      if (!entry) continue;
      const g = buildPrefab(entry, this.mats);
      g.position.set(...it.position);
      g.rotation.set(...it.rotation);
      g.scale.set(...it.scale);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material) {
          const mat = (m.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0.42;
          mat.depthWrite = false;
          m.material = mat;
        }
      });
      root.add(g);
    }
    // Bounds ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(38, 40, 48),
      new THREE.MeshBasicMaterial({
        color: 0x66e0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    root.add(ring);
    return root;
  }

  /** Place a duplicate of the selected (or given) object at pos */
  placeCopyAt(pos: THREE.Vector3, yaw?: number): EditorObject | null {
    const o = this.getSelected();
    if (!o) return null;
    const d = this.captureData(o);
    d.id = uid();
    d.position = [pos.x, snapYToLayer(pos.y), pos.z];
    if (yaw != null) d.rotation = [0, yaw, 0];
    const obj = this.spawnFromData(d, true);
    this.persist();
    if (obj) this.highlightLayer(yToLayer(obj.root.position.y), obj.data.id);
    this.markNetworkDirty();
    return obj;
  }

  select(id: string | null) {
    this.selectedId = id;
    this.clearOutline();
    if (!id) {
      this.clearLayerHighlights();
      return;
    }
    const o = this.objects.find((x) => x.data.id === id);
    if (!o) return;
    this.outline = new THREE.BoxHelper(o.root, 0xc4a35a);
    this.group.add(this.outline);
    this.highlightLayer(yToLayer(o.root.position.y), id);
  }

  getSelected(): EditorObject | null {
    if (!this.selectedId) return null;
    return this.objects.find((x) => x.data.id === this.selectedId) ?? null;
  }

  getSelectedLayer(): number | null {
    const o = this.getSelected();
    if (!o) return null;
    return yToLayer(o.root.position.y);
  }

  deleteSelected() {
    const o = this.getSelected();
    if (!o) return;
    this.group.remove(o.root);
    this.objects = this.objects.filter((x) => x.data.id !== o.data.id);
    this.selectedId = null;
    this.clearOutline();
    this.clearLayerHighlights();
    this.persist();
    this.markNetworkDirty();
  }

  duplicateSelected() {
    const o = this.getSelected();
    if (!o) return;
    const d = this.captureData(o);
    d.id = uid();
    d.position[0] += 2;
    d.position[2] += 2;
    d.position[1] = snapYToLayer(d.position[1]);
    this.spawnFromData(d, true);
    this.persist();
    this.highlightLayer(yToLayer(d.position[1]), d.id);
    this.markNetworkDirty();
  }

  /** cycle variant of selected */
  cycleVariant(dir: number) {
    const o = this.getSelected();
    if (!o) return;
    const variants = CATALOG.filter((c) => c.category === o.data.category);
    if (variants.length === 0) return;
    let idx = variants.findIndex((c) => c.variant === o.data.variant);
    idx = (idx + dir + variants.length) % variants.length;
    const entry = variants[idx]!;
    const data = this.captureData(o);
    data.variant = entry.variant;
    this.group.remove(o.root);
    this.objects = this.objects.filter((x) => x.data.id !== o.data.id);
    this.spawnFromData(data, true);
    this.persist();
    this.markNetworkDirty();
  }

  rotateSelected(dyaw: number) {
    const o = this.getSelected();
    if (!o) return;
    o.root.rotation.y += dyaw;
    this.refreshOutline();
    this.persist();
    this.markNetworkDirty();
  }

  /**
   * Scale selected object.
   * - uniform: all axes
   * - horizontal: X and Z only
   * - vertical: Y only
   */
  scaleSelected(factor: number, axis: ScaleAxis = 'uniform') {
    const o = this.getSelected();
    if (!o) return;
    if (axis === 'uniform') {
      o.root.scale.multiplyScalar(factor);
    } else if (axis === 'horizontal') {
      o.root.scale.x *= factor;
      o.root.scale.z *= factor;
    } else {
      o.root.scale.y *= factor;
    }
    o.root.scale.x = THREE.MathUtils.clamp(o.root.scale.x, 0.2, 8);
    o.root.scale.y = THREE.MathUtils.clamp(o.root.scale.y, 0.2, 8);
    o.root.scale.z = THREE.MathUtils.clamp(o.root.scale.z, 0.2, 8);
    this.refreshOutline();
    this.persist();
    this.markNetworkDirty();
  }

  /** Horizontal / free nudge; dy is ignored — use shiftLayer for vertical */
  nudgeSelected(dx: number, _dy: number, dz: number) {
    const o = this.getSelected();
    if (!o) return;
    o.root.position.x += dx;
    o.root.position.z += dz;
    this.refreshOutline();
    this.highlightLayer(yToLayer(o.root.position.y), o.data.id);
    this.persist();
    this.markNetworkDirty();
  }

  /** Move selected on its current layer (Y snapped) */
  moveSelectedTo(pos: THREE.Vector3, keepYaw = true) {
    const o = this.getSelected();
    if (!o) return;
    const layer = yToLayer(o.root.position.y);
    o.root.position.x = pos.x;
    o.root.position.z = pos.z;
    o.root.position.y = layerToY(layer);
    if (!keepYaw) {
      // yaw left as-is
    }
    this.refreshOutline();
    this.highlightLayer(layer, o.data.id);
    this.persist();
    this.markNetworkDirty();
  }

  /** Shift selected up/down by one half-story layer. Returns new layer. */
  shiftLayer(dir: number): number | null {
    const o = this.getSelected();
    if (!o) return null;
    const layer = yToLayer(o.root.position.y) + (dir > 0 ? 1 : -1);
    o.root.position.y = layerToY(layer);
    this.refreshOutline();
    this.highlightLayer(layer, o.data.id);
    this.persist();
    this.markNetworkDirty();
    return layer;
  }

  /** Set absolute layer for selected */
  setSelectedLayer(layer: number) {
    const o = this.getSelected();
    if (!o) return;
    o.root.position.y = layerToY(layer);
    this.refreshOutline();
    this.highlightLayer(layer, o.data.id);
    this.persist();
    this.markNetworkDirty();
  }

  markNetworkDirty() {
    this.networkDirty = true;
    this.rebuildNetwork();
  }

  private clearNetworkMesh() {
    while (this.networkGroup.children.length) {
      const ch = this.networkGroup.children[0]!;
      this.networkGroup.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          // Only dispose materials we created for the network (never shared mats.*)
          if (m.userData.networkOwnedMat) {
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else (mat as THREE.Material | undefined)?.dispose?.();
          }
        }
      });
    }
    this.networkResult = null;
  }

  /**
   * Rebuild smooth path/bridge/rail network from placed segments.
   * Nearby ends fuse; distant pieces stay separate.
   */
  rebuildNetwork() {
    this.clearNetworkMesh();
    const segs: import('./pathNetwork').NetSegment[] = [];
    for (const o of this.objects) {
      if (!isNetworkCategory(o.data.category)) {
        this.setPrefabVisualsVisible(o, true);
        continue;
      }
      // Hide raw box prefabs — network mesh is the truth
      this.setPrefabVisualsVisible(o, false);
      const s = segmentFromObject(
        o.data.id,
        o.data.category,
        o.data.variant,
        o.root.position,
        o.root.rotation.y,
        o.root.scale,
      );
      if (s) segs.push(s);
    }
    this.networkResult = buildPathNetwork(segs, this.mats);
    this.networkGroup.add(this.networkResult.group);
    this.networkDirty = false;
  }

  private setPrefabVisualsVisible(o: EditorObject, visible: boolean) {
    // Remove old proxy
    const oldProxy = o.root.getObjectByName('pickProxy');
    if (oldProxy) o.root.remove(oldProxy);

    o.root.traverse((ch) => {
      if (ch === o.root) return;
      if (ch.name === 'pickProxy') return;
      const m = ch as THREE.Mesh;
      if (m.isMesh) m.visible = visible;
    });

    if (!visible && isNetworkCategory(o.data.category)) {
      const st = segmentFromObject(
        o.data.id,
        o.data.category,
        o.data.variant,
        new THREE.Vector3(),
        0,
        o.root.scale,
      );
      const len = st ? st.a.distanceTo(st.b) : 8;
      const w = st ? st.width : 4;
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(w, 1), 1.4, Math.max(len, 1)),
        new THREE.MeshBasicMaterial({
          visible: false,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      proxy.name = 'pickProxy';
      proxy.position.y = 0.5;
      o.root.add(proxy);
      o.pickMeshes = [proxy];
    } else {
      const pick: THREE.Object3D[] = [];
      o.root.traverse((ch) => {
        if ((ch as THREE.Mesh).isMesh && ch.name !== 'pickProxy') pick.push(ch);
      });
      o.pickMeshes = pick;
    }
  }

  getNetworkStats(): { connections: number; junctions: number } {
    if (this.networkDirty) this.rebuildNetwork();
    return {
      connections: this.networkResult?.connectionCount ?? 0,
      junctions: this.networkResult?.junctionCount ?? 0,
    };
  }

  /** Lowest world Y among placed objects (base positions). */
  lowestObjectY(): number | null {
    if (this.objects.length === 0) return null;
    let minY = Infinity;
    for (const o of this.objects) {
      minY = Math.min(minY, o.root.position.y);
    }
    return Number.isFinite(minY) ? minY : null;
  }

  /** Count objects (excluding selected) on a layer */
  countOnLayer(layer: number, excludeId?: string | null): number {
    let n = 0;
    for (const o of this.objects) {
      if (excludeId && o.data.id === excludeId) continue;
      if (yToLayer(o.root.position.y) === layer) n++;
    }
    return n;
  }

  /**
   * Highlight peers on the same half-story layer (amber).
   * Selected stays green via outline.
   */
  highlightLayer(layer: number, excludeId?: string | null) {
    this.clearLayerHighlights();
    for (const o of this.objects) {
      if (excludeId && o.data.id === excludeId) continue;
      if (yToLayer(o.root.position.y) !== layer) continue;
      const h = new THREE.BoxHelper(o.root, 0xffaa33);
      this.group.add(h);
      this.layerHelpers.push(h);
    }
  }

  clearLayerHighlights() {
    for (const h of this.layerHelpers) this.group.remove(h);
    this.layerHelpers = [];
  }

  private refreshOutline() {
    if (this.selectedId) {
      const id = this.selectedId;
      this.clearOutline();
      const o = this.objects.find((x) => x.data.id === id);
      if (!o) return;
      this.outline = new THREE.BoxHelper(o.root, 0xc4a35a);
      this.group.add(this.outline);
    }
  }

  private clearOutline() {
    if (this.outline) {
      this.group.remove(this.outline);
      this.outline = null;
    }
  }

  updateGhost(pos: THREE.Vector3 | null, yaw: number) {
    if (!pos) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    const entry =
      CATALOG.find((c) => c.category === this.activeCategory && c.variant === this.activeVariant) ??
      catalogFallback(this.activeCategory);
    if (!entry) return;
    if (!this.ghost || this.ghostEntry?.category !== entry.category || this.ghostEntry?.variant !== entry.variant) {
      if (this.ghost) this.group.remove(this.ghost);
      this.ghost = buildPrefab(entry, this.mats);
      this.ghost.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material) {
          const mat = (m.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0.45;
          mat.depthWrite = false;
          m.material = mat;
        }
      });
      this.group.add(this.ghost);
      this.ghostEntry = entry;
    }
    this.ghost.visible = true;
    this.ghost.position.copy(pos);
    this.ghost.rotation.set(0, yaw, 0);
  }

  /** Raycast pick against placed objects */
  pick(raycaster: THREE.Raycaster): string | null {
    const meshes: THREE.Object3D[] = [];
    for (const o of this.objects) meshes.push(...o.pickMeshes);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;
    let obj: THREE.Object3D | null = hits[0]!.object;
    while (obj) {
      if (obj.userData.editorId) return obj.userData.editorId as string;
      obj = obj.parent;
    }
    return null;
  }

  /** Export rails/ramps/bumps/fog for gameplay — uses smoothed network when available */
  exportGameplay(): {
    rails: RaceRail[];
    ramps: RaceRamp[];
    bumps: THREE.Vector3[];
    fogZones: { pos: THREE.Vector3; radius: number; far: number }[];
    pathPoints: THREE.Vector3[];
  } {
    if (this.networkDirty) this.rebuildNetwork();

    const rails: RaceRail[] = [];
    const ramps: RaceRamp[] = [];
    const bumps: THREE.Vector3[] = [];
    const fogZones: { pos: THREE.Vector3; radius: number; far: number }[] = [];
    const pathPoints: THREE.Vector3[] = [];

    // Prefer merged network geometry
    if (this.networkResult) {
      for (const r of this.networkResult.rails) {
        rails.push({ points: r.points.map((p) => p.clone()) });
      }
      // Longest path polyline first (main route), then others
      const polys = [...this.networkResult.pathPolylines].sort(
        (a, b) => b.length - a.length,
      );
      for (const poly of polys) {
        for (const p of poly) pathPoints.push(p.clone());
      }
    }

    for (const o of this.objects) {
      const p = o.root.position.clone();
      const yaw = o.root.rotation.y;
      const sx = o.root.scale.x;
      const sy = o.root.scale.y;
      const sz = o.root.scale.z;

      // Fallback rails if network empty
      if (o.data.category === 'rail' && rails.length === 0) {
        const lens = [12, 20, 32, 8, 16];
        const elev = o.data.variant === 4 ? 1.2 : 0.75;
        const len = lens[o.data.variant]! * sz;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const a = p.clone().addScaledVector(forward, -len / 2);
        const b = p.clone().addScaledVector(forward, len / 2);
        a.y = p.y + elev * sy;
        b.y = p.y + elev * sy;
        const points: THREE.Vector3[] = [];
        const segs = Math.max(2, Math.floor(len / 4));
        for (let i = 0; i <= segs; i++) {
          points.push(a.clone().lerp(b, i / segs));
        }
        rails.push({ points });
      }

      if (o.data.category === 'stair') {
        const steps = [5, 7, 9, 6, 4][o.data.variant]!;
        const stepD = 1.1 * sz;
        ramps.push({
          pos: p.clone(),
          yaw,
          len: steps * stepD,
        });
        void sy;
      }

      if (o.data.category === 'building' || o.data.category === 'vehicle') {
        bumps.push(p.clone().add(new THREE.Vector3(0, 1, 0)));
      }

      if (o.data.category === 'fog') {
        const fars = [60, 40, 25, 16, 12];
        const sizes = [12, 16, 20, 14, 18];
        fogZones.push({
          pos: p.clone(),
          radius: (sizes[o.data.variant]! / 2) * Math.max(sx, sz),
          far: fars[o.data.variant]!,
        });
      }

      if (o.data.category === 'path' && pathPoints.length === 0) {
        const lens = [10, 16, 24, 12, 10];
        const len = lens[o.data.variant]! * sz;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const segs = Math.max(2, Math.floor(len / 5));
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          pathPoints.push(p.clone().addScaledVector(forward, (t - 0.5) * len));
        }
      }
    }

    return { rails, ramps, bumps, fogZones, pathPoints };
  }
}

function catalogFallback(cat: EditorCategory): CatalogEntry | undefined {
  return CATALOG.find((c) => c.category === cat);
}

export { ALL_CATEGORIES, CATEGORY_LABELS, CATALOG };
