/**
 * Floating sky-city sample district.
 * Platforms bob independently with underside energy domes + rings.
 * Free-floating paths/props sway on small levitation devices.
 * Buildings are enterable multi-floor interiors (office, factory, home, church, school).
 *
 * Design: walk paths for docks / parks / housing; open air channels for surfboard;
 * board travels dock-to-dock while walking handles explore / talk / fight.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { Collider } from './level';

export type PlatformShape = 'circle' | 'octagon' | 'hexagon' | 'rect' | 'diamond';
export type BuildingKind = 'office' | 'factory' | 'home' | 'church' | 'school';

/** Collider in an object's local space; rebuilt to world AABB each frame. */
export interface AttachedBox {
  object: THREE.Object3D;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** thin floor/step vs solid wall/obstacle */
  kind: 'floor' | 'solid';
}

export interface FloatPlatform {
  root: THREE.Group;
  phase: number;
  speed: number;
  amp: number;
  baseY: number;
  boxes: AttachedBox[];
}

export interface FreeFloat {
  root: THREE.Group;
  phase: number;
  speed: number;
  ampY: number;
  ampSway: number;
  baseY: number;
  basePos: THREE.Vector3;
  boxes: AttachedBox[];
}

/** Surfing sky lane — world-space polyline + sparse air-ribbon visuals */
export interface SkyRoute {
  path: THREE.Vector3[];
  pathDist: number[];
  /** Mesh segments animated as flowing air */
  ribbons: THREE.Mesh[];
}

export interface FloatingCityBuilt {
  group: THREE.Group;
  platforms: FloatPlatform[];
  freeFloats: FreeFloat[];
  /** All solids + floors for walking / board */
  colliders: Collider[];
  /** Thin floors only (snap feet) */
  floorColliders: Collider[];
  docks: THREE.Vector3[];
  sampleCenter: THREE.Vector3;
  /** Transparent air lanes for the surfboard between docks / sections */
  skyRoutes: SkyRoute[];
  animate: (time: number, dt: number) => void;
  sampleFloorY: (x: number, z: number, nearY: number) => number | null;
  /** Push a board-sized body out of solids; land on floors */
  resolveBoardCollision: (
    pos: THREE.Vector3,
    radius: number,
    height: number,
    vy: number,
  ) => { pos: THREE.Vector3; vy: number; onGround: boolean };
  /**
   * Pick the best path for surfing: sky lane if near city routes,
   * else null (caller should use race path).
   */
  preferSurfPath: (
    pos: THREE.Vector3,
  ) => { path: THREE.Vector3[]; pathDist: number[]; lateral: number; yaw: number } | null;
  /** Lowest solid/floor/sky content Y (for fall kill plane). */
  lowestContentY: () => number;
}

function boxCol(x: number, y0: number, z: number, w: number, h: number, d: number): Collider {
  return {
    min: new THREE.Vector3(x - w / 2, y0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y0 + h, z + d / 2),
  };
}

function attach(
  object: THREE.Object3D,
  x: number,
  y0: number,
  z: number,
  w: number,
  h: number,
  d: number,
  kind: 'floor' | 'solid',
): AttachedBox {
  const c = boxCol(x, y0, z, w, h, d);
  return { object, min: c.min, max: c.max, kind };
}

/**
 * Transform local AABB through object matrix → world AABB.
 * NOTE: non-axis-aligned parents fatten AABBs — keep building yaw at 90° steps.
 */
const _c = new THREE.Vector3();
function attachedToWorld(box: AttachedBox): Collider {
  box.object.updateWorldMatrix(true, false);
  const m = box.object.matrixWorld;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        _c.set(
          ix ? box.max.x : box.min.x,
          iy ? box.max.y : box.min.y,
          iz ? box.max.z : box.min.z,
        );
        _c.applyMatrix4(m);
        minX = Math.min(minX, _c.x);
        minY = Math.min(minY, _c.y);
        minZ = Math.min(minZ, _c.z);
        maxX = Math.max(maxX, _c.x);
        maxY = Math.max(maxY, _c.y);
        maxZ = Math.max(maxZ, _c.z);
      }
    }
  }
  return {
    min: new THREE.Vector3(minX, minY, minZ),
    max: new THREE.Vector3(maxX, maxY, maxZ),
    kind: box.kind,
  };
}

/** Snap yaw to 0/90/180/270 so wall AABBs stay tight (no diagonal fat boxes). */
function snapYawCardinal(yaw: number): number {
  const step = Math.PI / 2;
  return Math.round(yaw / step) * step;
}

function addMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function deckMaterial(tint: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: tint,
    metalness: 0.35,
    roughness: 0.55,
  });
}

/** Build platform deck geometry by shape */
function makeDeckGeo(shape: PlatformShape, radius: number): THREE.BufferGeometry {
  switch (shape) {
    case 'circle':
      return new THREE.CylinderGeometry(radius, radius * 1.02, 0.45, 28);
    case 'octagon':
      return new THREE.CylinderGeometry(radius, radius * 1.02, 0.45, 8);
    case 'hexagon':
      return new THREE.CylinderGeometry(radius, radius * 1.02, 0.45, 6);
    case 'diamond':
      return new THREE.CylinderGeometry(radius * 0.92, radius, 0.45, 4);
    case 'rect':
    default:
      return new THREE.BoxGeometry(radius * 1.7, 0.45, radius * 1.35);
  }
}

function makeEnergyDome(mats: Mats, radius: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'EnergyDome';
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x4a80a0,
    emissive: 0x2288cc,
    emissiveIntensity: 0.55,
    metalness: 0.4,
    roughness: 0.25,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), domeMat);
  dome.rotation.x = Math.PI;
  dome.position.y = -0.15;
  dome.name = 'domePulse';
  g.add(dome);

  // Core crystal
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(radius * 0.12, 0),
    new THREE.MeshStandardMaterial({
      color: 0xa8e8ff,
      emissive: 0x44ccff,
      emissiveIntensity: 0.9,
      metalness: 0.3,
      roughness: 0.2,
    }),
  );
  core.position.y = -radius * 0.25;
  core.name = 'domeCore';
  g.add(core);

  // Ring emitters (animated scale/opacity in animate)
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.35, 0.04, 6, 28),
      new THREE.MeshStandardMaterial({
        color: 0x66d8ff,
        emissive: 0x2288ff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.55,
        metalness: 0.5,
        roughness: 0.3,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.4 - i * 0.15;
    ring.name = `energyRing_${i}`;
    ring.userData.ringIndex = i;
    g.add(ring);
  }

  // Brass housing ribs
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, radius * 0.35, 0.08),
      mats.brass,
    );
    rib.position.set(Math.cos(ang) * radius * 0.28, -radius * 0.18, Math.sin(ang) * radius * 0.28);
    g.add(rib);
  }
  return g;
}

/** Sparse transparent air ribbon segment between two points */
function makeAirRibbonSeg(
  a: THREE.Vector3,
  b: THREE.Vector3,
  width: number,
  parent: THREE.Object3D,
): THREE.Mesh {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const delta = b.clone().sub(a);
  const len = Math.max(0.4, delta.length());
  const yaw = Math.atan2(delta.x, delta.z);
  const horiz = Math.hypot(delta.x, delta.z);
  const pitch = horiz > 1e-4 ? -Math.atan2(delta.y, horiz) : 0;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xa8e8ff,
    emissive: 0x44aadd,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.22,
    metalness: 0.15,
    roughness: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len, 1, 2), mat);
  mesh.position.copy(mid);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = yaw;
  mesh.rotation.x = pitch + Math.PI / 2; // plane lies along path
  mesh.name = 'skyRibbon';
  mesh.userData.flowPhase = Math.random() * Math.PI * 2;
  mesh.renderOrder = 2;
  parent.add(mesh);

  // Soft edge glow strip
  const edge = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.12, len * 0.95, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x88ddff,
      emissive: 0x3399dd,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  edge.position.copy(mid);
  edge.position.y += 0.04;
  edge.rotation.order = 'YXZ';
  edge.rotation.y = yaw;
  edge.rotation.x = pitch + Math.PI / 2;
  edge.name = 'skyRibbonEdge';
  edge.userData.flowPhase = mesh.userData.flowPhase;
  parent.add(edge);

  return mesh;
}

function buildSkyRouteFromControls(
  controls: THREE.Vector3[],
  parent: THREE.Object3D,
  width = 5.5,
): SkyRoute {
  const curve = new THREE.CatmullRomCurve3(
    controls.map((p) => p.clone()),
    false,
    'catmullrom',
    0.45,
  );
  const total = Math.max(1, curve.getLength());
  const samples = Math.max(12, Math.ceil(total / 3.5));
  const path = curve.getSpacedPoints(samples);
  const pathDist: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    pathDist.push(pathDist[i - 1]! + path[i]!.distanceTo(path[i - 1]!));
  }

  const ribbons: THREE.Mesh[] = [];
  // Sparse: short air wisps with gaps (flow feel, not a solid road)
  for (let i = 0; i < path.length - 1; i += 3) {
    const a = path[i]!;
    const b = path[Math.min(i + 1, path.length - 1)]!;
    ribbons.push(makeAirRibbonSeg(a, b, width * (0.85 + (i % 2) * 0.15), parent));
    // occasional second parallel wisp
    if (i % 6 === 0 && i + 2 < path.length) {
      const tan = b.clone().sub(a);
      if (tan.lengthSq() > 1e-6) {
        tan.normalize();
        const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
        const a2 = a.clone().addScaledVector(right, width * 0.35);
        const b2 = b.clone().addScaledVector(right, width * 0.35);
        a2.y += 0.35;
        b2.y += 0.35;
        ribbons.push(makeAirRibbonSeg(a2, b2, width * 0.45, parent));
      }
    }
  }

  // Soft glowing dots along the lane (sparse)
  for (let i = 0; i < path.length; i += 5) {
    const p = path[i]!;
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xc8f0ff,
        emissive: 0x66ccff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    mote.position.copy(p);
    mote.name = 'skyMote';
    mote.userData.flowPhase = i * 0.4;
    parent.add(mote);
    ribbons.push(mote);
  }

  return { path, pathDist, ribbons };
}

function makeLevitator(mats: Mats, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Levitator';
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55 * scale, 0.7 * scale, 0.15 * scale, 10),
    mats.brass,
  );
  dish.position.y = -0.2;
  g.add(dish);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.28 * scale, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      emissive: 0x2288cc,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.7,
    }),
  );
  glow.position.y = -0.45 * scale;
  glow.name = 'leviGlow';
  g.add(glow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5 * scale, 0.035 * scale, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0x88ddff,
      emissive: 0x44aaff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.5,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.55 * scale;
  ring.name = 'leviRing';
  g.add(ring);
  return g;
}

function plaque(
  parent: THREE.Object3D,
  mats: Mats,
  text: string,
  x: number,
  y: number,
  z: number,
  yaw: number,
) {
  const plate = addMesh(parent, new THREE.BoxGeometry(1.4, 0.55, 0.08), mats.brass, x, y, z, 0, yaw, 0);
  void plate;
  // simple canvas label
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2a2218';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#c4a35a';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#f0e0b0';
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.45),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  sign.position.set(x, y, z);
  sign.rotation.y = yaw;
  sign.position.add(new THREE.Vector3(Math.sin(yaw) * 0.06, 0, Math.cos(yaw) * 0.06));
  parent.add(sign);
}

// ——— Building interiors ———

interface BuildingBuild {
  group: THREE.Group;
  boxes: AttachedBox[];
  footprint: number;
}

function addStep(
  g: THREE.Group,
  boxes: AttachedBox[],
  mat: THREE.Material,
  x: number,
  yBase: number,
  z: number,
  w: number,
  stepH: number,
  stepD: number,
  index: number,
) {
  const top = (index + 1) * stepH;
  addMesh(g, new THREE.BoxGeometry(w, top, stepD), mat, x, yBase + top / 2, z);
  // Walkable top only — full-height solids blocked walking up stairs
  boxes.push(attach(g, x, yBase + top - 0.06, z, w * 0.95, 0.14, stepD * 0.95, 'floor'));
}

function buildBuilding(
  kind: BuildingKind,
  mats: Mats,
  floorsWanted: number,
): BuildingBuild {
  const g = new THREE.Group();
  g.name = `Building_${kind}`;
  const boxes: AttachedBox[] = [];
  const floorH = 3.1;
  const nFloors = Math.max(1, floorsWanted);

  const wood = mats.wood;
  const brass = mats.brass;
  const iron = mats.iron;
  const glass = mats.glass;
  const stone = mats.stone;

  if (kind === 'office') {
    const w = 9;
    const d = 8;
    const wallT = 0.35;
    const doorW = 2.8;
    for (let f = 0; f < nFloors; f++) {
      const y = f * floorH;
      addMesh(g, new THREE.BoxGeometry(w, 0.22, d), iron, 0, y, 0);
      boxes.push(attach(g, 0, y - 0.02, 0, w, 0.28, d, 'floor'));
      if (f < nFloors - 1) {
        addMesh(g, new THREE.BoxGeometry(w, 0.15, d), iron, 0, y + floorH - 0.1, 0);
        boxes.push(attach(g, 0, y + floorH - 0.18, 0, w, 0.2, d, 'solid')); // ceiling solid
      }
      const openDoor = f === 0;
      // Back wall
      addMesh(g, new THREE.BoxGeometry(w, floorH - 0.15, wallT), brass, 0, y + floorH / 2, -d / 2);
      boxes.push(attach(g, 0, y, -d / 2, w, floorH, wallT + 0.15, 'solid'));
      // Sides
      for (const sx of [-1, 1]) {
        addMesh(g, new THREE.BoxGeometry(wallT, floorH - 0.15, d), brass, (sx * w) / 2, y + floorH / 2, 0);
        boxes.push(attach(g, (sx * w) / 2, y, 0, wallT + 0.15, floorH, d, 'solid'));
      }
      // Front — door gap only on ground floor
      if (openDoor) {
        const sideW = (w - doorW) / 2;
        for (const sx of [-1, 1]) {
          const cx = sx * (doorW / 2 + sideW / 2);
          addMesh(g, new THREE.BoxGeometry(sideW, floorH - 0.15, wallT), brass, cx, y + floorH / 2, d / 2);
          boxes.push(attach(g, cx, y, d / 2, sideW, floorH, wallT + 0.15, 'solid'));
        }
        addMesh(g, new THREE.BoxGeometry(doorW + 0.3, 0.4, wallT + 0.05), brass, 0, y + 2.45, d / 2);
        boxes.push(attach(g, 0, y + 2.25, d / 2, doorW + 0.3, 0.5, wallT + 0.15, 'solid'));
      } else {
        addMesh(g, new THREE.BoxGeometry(w, floorH - 0.15, wallT), brass, 0, y + floorH / 2, d / 2);
        boxes.push(attach(g, 0, y, d / 2, w, floorH, wallT + 0.15, 'solid'));
        addMesh(g, new THREE.BoxGeometry(w * 0.7, 0.9, 0.06), glass, 0, y + 1.6, d / 2 + 0.1);
      }
      for (let i = 0; i < 3; i++) {
        addMesh(g, new THREE.BoxGeometry(1.4, 0.7, 0.7), wood, -2.5 + i * 2.2, y + 0.4, -1.2);
        boxes.push(attach(g, -2.5 + i * 2.2, y, -1.2, 1.4, 0.75, 0.7, 'solid'));
      }
      addMesh(g, new THREE.BoxGeometry(0.15, 1.6, 3), iron, 1.5, y + 0.9, 0.5);
      boxes.push(attach(g, 1.5, y, 0.5, 0.2, 1.7, 3, 'solid'));
      if (f < nFloors - 1) {
        for (let s = 0; s < 9; s++) {
          addStep(g, boxes, stone, -w / 2 + 1.35, y, -d / 2 + 1.0 + s * 0.5, 1.55, 0.34, 0.5, s);
        }
      }
    }
    addMesh(g, new THREE.BoxGeometry(w + 0.4, 0.25, d + 0.4), brass, 0, nFloors * floorH, 0);
    boxes.push(attach(g, 0, nFloors * floorH - 0.05, 0, w + 0.4, 0.3, d + 0.4, 'floor'));
    addMesh(g, new THREE.CylinderGeometry(0.08, 0.12, 2.2, 6), iron, 2, nFloors * floorH + 1.2, -2);
    plaque(g, mats, 'VOSS & CO.', 0, 2.6, d / 2 + 0.05, 0);
    return { group: g, boxes, footprint: Math.max(w, d) * 0.55 };
  }

  if (kind === 'factory') {
    const w = 11;
    const d = 10;
    const h = floorH * Math.min(nFloors, 2) + 1.5;
    // Wide central door — easy to walk through
    const doorW = 4.2;
    addMesh(g, new THREE.BoxGeometry(w, 0.3, d), iron, 0, 0, 0);
    boxes.push(attach(g, 0, -0.02, 0, w, 0.32, d, 'floor'));
    // Back + sides only
    addMesh(g, new THREE.BoxGeometry(w, h, 0.35), iron, 0, h / 2, -d / 2);
    boxes.push(attach(g, 0, 0, -d / 2, w, h, 0.4, 'solid'));
    for (const sx of [-1, 1]) {
      addMesh(g, new THREE.BoxGeometry(0.35, h, d), iron, (sx * w) / 2, h / 2, 0);
      boxes.push(attach(g, (sx * w) / 2, 0, 0, 0.4, h, d, 'solid'));
    }
    // Front walls with clear door gap (no collider in doorway)
    const sideW = (w - doorW) / 2;
    for (const sx of [-1, 1]) {
      const cx = sx * (doorW / 2 + sideW / 2);
      addMesh(g, new THREE.BoxGeometry(sideW, h, 0.35), iron, cx, h / 2, d / 2);
      boxes.push(attach(g, cx, 0, d / 2, sideW * 0.98, h, 0.4, 'solid'));
    }
    // Lintel above door only
    addMesh(g, new THREE.BoxGeometry(doorW + 0.2, 0.4, 0.4), brass, 0, h - 0.3, d / 2);
    boxes.push(attach(g, 0, h - 0.55, d / 2, doorW + 0.2, 0.5, 0.4, 'solid'));
    if (nFloors >= 2) {
      addMesh(g, new THREE.BoxGeometry(w * 0.55, 0.2, d * 0.7), iron, -w * 0.15, floorH, 0);
      boxes.push(attach(g, -w * 0.15, floorH - 0.05, 0, w * 0.55, 0.28, d * 0.7, 'floor'));
      for (let s = 0; s < 8; s++) {
        addStep(g, boxes, stone, w / 2 - 1.5, 0, -2.2 + s * 0.5, 1.6, 0.38, 0.5, s);
      }
    }
    // Machinery kept off the door centerline (back of shop)
    addMesh(g, new THREE.CylinderGeometry(1.2, 1.4, 2.5, 12), brass, -2.5, 1.3, -2.2);
    boxes.push(attach(g, -2.5, 0, -2.2, 2.4, 2.5, 2.4, 'solid'));
    addMesh(g, new THREE.BoxGeometry(2, 1.2, 1.2), iron, 3, 0.7, -1.5);
    boxes.push(attach(g, 3, 0, -1.5, 2, 1.3, 1.2, 'solid'));
    for (let i = 0; i < 3; i++) {
      addMesh(g, new THREE.BoxGeometry(w / 3 - 0.1, 0.8, d), iron, -w / 3 + i * (w / 3), h + 0.3, 0);
    }
    // Roof solids high — don't use a full-height box that fills the volume
    boxes.push(attach(g, 0, h + 0.1, 0, w, 0.9, d, 'solid'));
    plaque(g, mats, 'GEARWORKS', 0, 2.8, d / 2 + 0.05, 0);
    return { group: g, boxes, footprint: Math.max(w, d) * 0.55 };
  }

  if (kind === 'home') {
    const w = 7;
    const d = 6.5;
    const doorW = 2.2;
    for (let f = 0; f < Math.min(nFloors, 3); f++) {
      const y = f * 2.85;
      addMesh(g, new THREE.BoxGeometry(w, 0.2, d), wood, 0, y, 0);
      boxes.push(attach(g, 0, y - 0.02, 0, w, 0.28, d, 'floor'));
      const wh = 2.7;
      addMesh(g, new THREE.BoxGeometry(w, wh, 0.28), wood, 0, y + wh / 2, -d / 2);
      boxes.push(attach(g, 0, y, -d / 2, w, wh, 0.4, 'solid'));
      for (const sx of [-1, 1]) {
        addMesh(g, new THREE.BoxGeometry(0.28, wh, d), wood, (sx * w) / 2, y + wh / 2, 0);
        boxes.push(attach(g, (sx * w) / 2, y, 0, 0.4, wh, d, 'solid'));
      }
      if (f === 0) {
        const sideW = (w - doorW) / 2;
        for (const sx of [-1, 1]) {
          const cx = sx * (doorW / 2 + sideW / 2);
          addMesh(g, new THREE.BoxGeometry(sideW, wh, 0.28), wood, cx, y + wh / 2, d / 2);
          boxes.push(attach(g, cx, y, d / 2, sideW, wh, 0.4, 'solid'));
        }
      } else {
        addMesh(g, new THREE.BoxGeometry(w, wh, 0.28), wood, 0, y + wh / 2, d / 2);
        boxes.push(attach(g, 0, y, d / 2, w, wh, 0.4, 'solid'));
        addMesh(g, new THREE.BoxGeometry(1.2, 0.8, 0.05), glass, 0, y + 1.4, d / 2 + 0.1);
      }
      addMesh(g, new THREE.BoxGeometry(1.6, 0.5, 0.7), mats.woodDark, 1.5, y + 0.3, -1);
      boxes.push(attach(g, 1.5, y, -1, 1.6, 0.55, 0.7, 'solid'));
      if (f < Math.min(nFloors, 3) - 1) {
        for (let s = 0; s < 8; s++) {
          addStep(g, boxes, stone, w / 2 - 1.15, y, -d / 2 + 1 + s * 0.48, 1.35, 0.36, 0.48, s);
        }
      }
    }
    const top = Math.min(nFloors, 3) * 2.85;
    addMesh(g, new THREE.ConeGeometry(5.2, 2.2, 4), mats.copper, 0, top + 1.0, 0, 0, Math.PI / 4, 0);
    plaque(g, mats, 'SKYFLAT 3B', 0, 2.2, d / 2 + 0.05, 0);
    return { group: g, boxes, footprint: Math.max(w, d) * 0.58 };
  }

  if (kind === 'church') {
    const w = 8;
    const d = 12;
    const naveH = 5.5;
    const doorW = 2.8;
    addMesh(g, new THREE.BoxGeometry(w, 0.25, d), stone, 0, 0, 0);
    boxes.push(attach(g, 0, -0.02, 0, w, 0.32, d, 'floor'));
    addMesh(g, new THREE.BoxGeometry(w, naveH, 0.35), stone, 0, naveH / 2, -d / 2);
    boxes.push(attach(g, 0, 0, -d / 2, w, naveH, 0.45, 'solid'));
    for (const sx of [-1, 1]) {
      addMesh(g, new THREE.BoxGeometry(0.35, naveH, d), stone, (sx * w) / 2, naveH / 2, 0);
      boxes.push(attach(g, (sx * w) / 2, 0, 0, 0.45, naveH, d, 'solid'));
      addMesh(g, new THREE.BoxGeometry(0.08, 2.2, 1.2), glass, (sx * w) / 2 + sx * 0.1, 2.5, 0);
    }
    const sideW = (w - doorW) / 2;
    for (const sx of [-1, 1]) {
      const cx = sx * (doorW / 2 + sideW / 2);
      addMesh(g, new THREE.BoxGeometry(sideW, naveH, 0.35), stone, cx, naveH / 2, d / 2);
      boxes.push(attach(g, cx, 0, d / 2, sideW, naveH, 0.45, 'solid'));
    }
    addMesh(g, new THREE.BoxGeometry(doorW + 0.2, 0.4, 0.4), brass, 0, 3.2, d / 2);
    boxes.push(attach(g, 0, 3.0, d / 2, doorW + 0.2, 0.5, 0.45, 'solid'));
    for (let i = 0; i < 4; i++) {
      addMesh(g, new THREE.BoxGeometry(5, 0.6, 0.5), wood, 0, 0.35, -3 + i * 1.5);
      boxes.push(attach(g, 0, 0, -3 + i * 1.5, 5, 0.65, 0.55, 'solid'));
    }
    addMesh(g, new THREE.BoxGeometry(2.5, 0.9, 1.2), brass, 0, 0.5, -d / 2 + 1.8);
    boxes.push(attach(g, 0, 0, -d / 2 + 1.8, 2.5, 0.95, 1.2, 'solid'));
    addMesh(g, new THREE.BoxGeometry(w - 1, 0.2, 3), wood, 0, 3.2, d / 2 - 2);
    boxes.push(attach(g, 0, 3.15, d / 2 - 2, w - 1, 0.28, 3, 'floor'));
    for (let s = 0; s < 9; s++) {
      addStep(g, boxes, stone, w / 2 - 1.25, 0, d / 2 - 3.8 + s * 0.45, 1.45, 0.36, 0.45, s);
    }
    plaque(g, mats, 'ST. BRASS', 0, 4.0, d / 2 + 0.05, 0);
    return { group: g, boxes, footprint: Math.max(w, d) * 0.52 };
  }

  // school
  {
    const w = 12;
    const d = 7;
    const doorW = 3.5;
    for (let f = 0; f < Math.min(nFloors, 2); f++) {
      const y = f * floorH;
      addMesh(g, new THREE.BoxGeometry(w, 0.2, d), stone, 0, y, 0);
      boxes.push(attach(g, 0, y - 0.02, 0, w, 0.28, d, 'floor'));
      const wh = floorH - 0.15;
      addMesh(g, new THREE.BoxGeometry(w, wh, 0.3), brass, 0, y + wh / 2, -d / 2);
      boxes.push(attach(g, 0, y, -d / 2, w, wh, 0.4, 'solid'));
      for (const sx of [-1, 1]) {
        addMesh(g, new THREE.BoxGeometry(0.3, wh, d), brass, (sx * w) / 2, y + wh / 2, 0);
        boxes.push(attach(g, (sx * w) / 2, y, 0, 0.4, wh, d, 'solid'));
      }
      if (f === 0) {
        const sideW = (w - doorW) / 2;
        for (const sx of [-1, 1]) {
          const cx = sx * (doorW / 2 + sideW / 2);
          addMesh(g, new THREE.BoxGeometry(sideW, wh, 0.3), brass, cx, y + wh / 2, d / 2);
          boxes.push(attach(g, cx, y, d / 2, sideW, wh, 0.4, 'solid'));
        }
      } else {
        addMesh(g, new THREE.BoxGeometry(w, wh, 0.3), brass, 0, y + wh / 2, d / 2);
        boxes.push(attach(g, 0, y, d / 2, w, wh, 0.4, 'solid'));
      }
      addMesh(g, new THREE.BoxGeometry(0.2, wh - 0.3, d - 1), iron, 0, y + wh / 2, 0);
      boxes.push(attach(g, 0, y, 0, 0.25, wh - 0.2, d - 1, 'solid'));
      for (let i = 0; i < 4; i++) {
        addMesh(g, new THREE.BoxGeometry(1.1, 0.55, 0.6), wood, -4 + i * 1.5, y + 0.35, -1.5);
        boxes.push(attach(g, -4 + i * 1.5, y, -1.5, 1.1, 0.6, 0.6, 'solid'));
      }
      if (f === 0) {
        for (let s = 0; s < 9; s++) {
          addStep(g, boxes, stone, w / 2 - 1.35, y, -d / 2 + 1.1 + s * 0.48, 1.55, 0.34, 0.48, s);
        }
      }
    }
    addMesh(g, new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), brass, 0, Math.min(nFloors, 2) * floorH, 0);
    boxes.push(attach(g, 0, Math.min(nFloors, 2) * floorH - 0.05, 0, w + 0.3, 0.3, d + 0.3, 'floor'));
    plaque(g, mats, 'CLOUD ACADEMY', 0, 2.5, d / 2 + 0.05, 0);
    return { group: g, boxes, footprint: Math.max(w, d) * 0.52 };
  }
}

function addTrees(
  parent: THREE.Object3D,
  mats: Mats,
  count: number,
  radius: number,
  rng: () => number,
) {
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const r = radius * (0.55 + rng() * 0.35);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6), mats.wood);
    trunk.position.set(x, 0.7, z);
    parent.add(trunk);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 + rng() * 0.35, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x3d5a42, roughness: 0.9 }),
    );
    leaf.position.set(x, 1.7 + rng() * 0.3, z);
    parent.add(leaf);
  }
}

function addFountain(parent: THREE.Object3D, mats: Mats, x: number, z: number) {
  addMesh(parent, new THREE.CylinderGeometry(1.4, 1.6, 0.45, 12), mats.brass, x, 0.25, z);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.15, 12),
    new THREE.MeshStandardMaterial({
      color: 0x4ec8ff,
      transparent: true,
      opacity: 0.65,
      metalness: 0.2,
      roughness: 0.15,
    }),
  );
  water.position.set(x, 0.48, z);
  water.name = 'fountainWater';
  parent.add(water);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.28, 2.2, 8),
    new THREE.MeshStandardMaterial({
      color: 0x66d8ff,
      transparent: true,
      opacity: 0.5,
      emissive: 0x2288cc,
      emissiveIntensity: 0.35,
      depthWrite: false,
    }),
  );
  jet.position.set(x, 1.4, z);
  jet.name = 'fountainWater';
  parent.add(jet);
}

/**
 * Build the demonstration floating-city district.
 * Centered at `origin` (default near race start so player can find it).
 */
export function buildFloatingCitySample(
  mats: Mats,
  origin = new THREE.Vector3(0, 8, -40),
): FloatingCityBuilt {
  const group = new THREE.Group();
  group.name = 'FloatingCitySample';
  group.position.copy(origin);

  const platforms: FloatPlatform[] = [];
  const freeFloats: FreeFloat[] = [];
  const docks: THREE.Vector3[] = [];
  let seed = 42;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const shapes: PlatformShape[] = ['circle', 'octagon', 'hexagon', 'rect', 'diamond', 'circle'];
  const kinds: BuildingKind[] = ['office', 'factory', 'home', 'church', 'school', 'home'];
  // Loose arc of platforms around a central plaza / open air channel
  const layout = [
    { x: -28, z: 8, r: 14, floors: 3 },
    { x: 0, z: 18, r: 16, floors: 2 },
    { x: 30, z: 6, r: 13, floors: 4 },
    { x: -18, z: -16, r: 12, floors: 2 },
    { x: 16, z: -18, r: 15, floors: 3 },
    { x: 0, z: -4, r: 11, floors: 1 }, // park platform
  ];

  layout.forEach((slot, i) => {
    const shape = shapes[i]!;
    const kind = kinds[i]!;
    const isPark = i === 5;
    const plat = new THREE.Group();
    plat.name = `Platform_${i}_${shape}`;
    plat.position.set(slot.x, 0, slot.z);

    const tint = [0x5a5348, 0x6a5f4e, 0x555860, 0x63584a, 0x5a5348, 0x4a5a48][i]!;
    const deck = new THREE.Mesh(makeDeckGeo(shape, slot.r), deckMaterial(tint));
    deck.position.y = 0.2;
    deck.receiveShadow = true;
    deck.castShadow = true;
    plat.add(deck);

    // Rim rail for circles / polygons
    if (shape !== 'rect') {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(slot.r * 0.98, 0.08, 6, shape === 'circle' ? 28 : 8),
        mats.iron,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.48;
      plat.add(rim);
    } else {
      // rect curb
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(slot.r * 1.72, 0.2, slot.r * 1.38),
        mats.iron,
      );
      curb.position.y = 0.42;
      plat.add(curb);
    }

    const dome = makeEnergyDome(mats, slot.r);
    dome.position.y = 0;
    plat.add(dome);

    const boxes: AttachedBox[] = [];
    // Deck floor only (thin). No tall under-solid — it bloated AABBs and blocked doors.
    const deckW = shape === 'rect' ? slot.r * 1.7 : slot.r * 1.9;
    const deckD = shape === 'rect' ? slot.r * 1.35 : slot.r * 1.9;
    boxes.push(attach(plat, 0, 0.15, 0, deckW, 0.32, deckD, 'floor'));

    if (isPark) {
      addTrees(plat, mats, 6, slot.r * 0.75, rng);
      addFountain(plat, mats, 0, 0);
      boxes.push(attach(plat, 0, 0.35, 0, 3.2, 1.2, 3.2, 'solid')); // fountain basin
      for (let b = 0; b < 3; b++) {
        const ang = (b / 3) * Math.PI * 2;
        const bx = Math.cos(ang) * 4;
        const bz = Math.sin(ang) * 4;
        addMesh(plat, new THREE.BoxGeometry(1.6, 0.35, 0.45), mats.wood, bx, 0.55, bz, 0, ang, 0);
        boxes.push(attach(plat, bx, 0.35, bz, 1.6, 0.45, 0.55, 'solid'));
      }
      plaque(plat, mats, 'SKY PARK', 0, 1.2, slot.r * 0.7, 0);
    } else {
      const bld = buildBuilding(kind, mats, slot.floors);
      // Cardinal yaw only — diagonal rotation explodes AABB walls into doorways
      const face = Math.atan2(-slot.x, -slot.z);
      bld.group.rotation.y = snapYawCardinal(face + Math.PI);
      bld.group.position.y = 0.42;
      plat.add(bld.group);
      boxes.push(...bld.boxes);
      // Trees/fountains toward platform rim, not in front of door (+Z local after face)
      addTrees(plat, mats, 2 + Math.floor(rng() * 2), slot.r * 0.85, rng);
      if (rng() > 0.45) {
        const fx = slot.r * 0.55;
        const fz = -slot.r * 0.35; // off the entrance axis
        addFountain(plat, mats, fx, fz);
        boxes.push(attach(plat, fx, 0.35, fz, 2.8, 1.0, 2.8, 'solid'));
      }
    }

    group.add(plat);
    platforms.push({
      root: plat,
      phase: rng() * Math.PI * 2,
      speed: 0.18 + rng() * 0.12,
      amp: 0.12 + rng() * 0.1,
      baseY: 0,
      boxes,
    });
  });

  // ——— Docks: free-floating walk pads with levitators (surf targets) ———
  const dockLocal = [
    new THREE.Vector3(0, -2, 32),
    new THREE.Vector3(-35, -1, -5),
    new THREE.Vector3(38, -1.5, -8),
  ];
  dockLocal.forEach((p, i) => {
    const dock = new THREE.Group();
    dock.position.copy(p);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.35, 8),
      deckMaterial(0x5a5348),
    );
    pad.position.y = 0.15;
    dock.add(pad);
    // Brass edge
    addMesh(dock, new THREE.BoxGeometry(10.3, 0.15, 8.3), mats.brass, 0, 0.4, 0);
    dock.add(makeLevitator(mats, 1.4));
    // Bollards
    for (const bx of [-3.5, 3.5]) {
      addMesh(dock, new THREE.CylinderGeometry(0.2, 0.25, 1.1, 8), mats.iron, bx, 0.7, 3);
    }
    plaque(dock, mats, `DOCK ${String.fromCharCode(65 + i)}`, 0, 1.5, 0, 0);
    // Boarding chevrons
    for (let c = 0; c < 3; c++) {
      addMesh(
        dock,
        new THREE.BoxGeometry(0.8, 0.05, 0.25),
        new THREE.MeshStandardMaterial({
          color: 0xc4a35a,
          emissive: 0x886622,
          emissiveIntensity: 0.3,
        }),
        0,
        0.38,
        1 + c * 0.7,
      );
    }
    group.add(dock);
    freeFloats.push({
      root: dock,
      phase: rng() * Math.PI * 2,
      speed: 0.22 + rng() * 0.08,
      ampY: 0.14,
      ampSway: 0.12,
      baseY: p.y,
      basePos: p.clone(),
      boxes: [
        attach(dock, 0, 0.08, 0, 10, 0.35, 8, 'floor'),
        attach(dock, 0, -0.35, 0, 9.5, 0.45, 7.5, 'solid'),
        attach(dock, -3.5, 0.2, 3, 0.5, 1.2, 0.5, 'solid'),
        attach(dock, 3.5, 0.2, 3, 0.5, 1.2, 0.5, 'solid'),
      ],
    });
    docks.push(origin.clone().add(p));
  });

  // ——— Walk paths: narrow floating bridges between some platforms (NOT roads) ———
  const bridges: { a: number; b: number }[] = [
    { a: 0, b: 5 },
    { a: 5, b: 1 },
    { a: 5, b: 3 },
    { a: 1, b: 2 },
    { a: 3, b: 4 },
  ];
  for (const br of bridges) {
    const A = layout[br.a]!;
    const B = layout[br.b]!;
    const mid = new THREE.Vector3((A.x + B.x) / 2, 0.5, (A.z + B.z) / 2);
    const dx = B.x - A.x;
    const dz = B.z - A.z;
    const len = Math.hypot(dx, dz) - A.r * 0.7 - B.r * 0.7;
    if (len < 4) continue;
    const yaw = Math.atan2(dx, dz);
    const path = new THREE.Group();
    path.position.copy(mid);
    path.rotation.y = yaw;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.28, len),
      deckMaterial(0x5a5348),
    );
    deck.position.y = 0.1;
    path.add(deck);
    // Rails
    for (const s of [-1, 1]) {
      addMesh(path, new THREE.BoxGeometry(0.1, 0.45, len), mats.iron, s * 1.5, 0.4, 0);
    }
    // Levitators along span
    const nLev = Math.max(2, Math.floor(len / 8));
    for (let i = 0; i < nLev; i++) {
      const t = (i + 0.5) / nLev;
      const lev = makeLevitator(mats, 0.75);
      lev.position.set(0, 0, (t - 0.5) * len);
      path.add(lev);
    }
    group.add(path);
    freeFloats.push({
      root: path,
      phase: rng() * Math.PI * 2,
      speed: 0.18 + rng() * 0.06,
      ampY: 0.08,
      ampSway: 0.08,
      baseY: mid.y,
      basePos: mid.clone(),
      boxes: [
        attach(path, 0, 0.02, 0, 3.2, 0.32, len, 'floor'),
        attach(path, 0, -0.25, 0, 3.0, 0.3, len, 'solid'),
        attach(path, -1.5, 0.15, 0, 0.2, 0.55, len, 'solid'),
        attach(path, 1.5, 0.15, 0, 0.2, 0.55, len, 'solid'),
      ],
    });
  }

  // ——— Sky paths: transparent air ribbons for surfing between docks / platforms ———
  // Points are LOCAL to group; convert to world for board path following.
  const toWorld = (x: number, y: number, z: number) =>
    new THREE.Vector3(x + origin.x, y + origin.y, z + origin.z);

  const skyGroup = new THREE.Group();
  skyGroup.name = 'SkyPathRibbons';
  group.add(skyGroup);

  const skyRoutes: SkyRoute[] = [];
  // Dock locals: (0,-2,32), (-35,-1,-5), (38,-1.5,-8)
  // High arcs that clear platforms
  const routeControls: THREE.Vector3[][] = [
    // Dock A → center channel → Dock B
    [
      toWorld(0, 2, 32),
      toWorld(-6, 7, 22),
      toWorld(-14, 9, 10),
      toWorld(-22, 8, 0),
      toWorld(-32, 5, -4),
      toWorld(-35, 2, -5),
    ],
    // Dock A → east weave → Dock C
    [
      toWorld(0, 2.5, 32),
      toWorld(8, 8, 20),
      toWorld(18, 10, 8),
      toWorld(28, 9, -2),
      toWorld(36, 5, -6),
      toWorld(38, 2, -8),
    ],
    // Dock B → south loop past park → Dock C
    [
      toWorld(-35, 2, -5),
      toWorld(-20, 9, -12),
      toWorld(-4, 11, -8),
      toWorld(12, 10, -14),
      toWorld(28, 7, -12),
      toWorld(38, 2, -8),
    ],
    // Grand circuit above district (closed loop feeling)
    [
      toWorld(0, 12, 20),
      toWorld(22, 14, 8),
      toWorld(26, 13, -12),
      toWorld(0, 15, -22),
      toWorld(-26, 13, -10),
      toWorld(-22, 14, 10),
      toWorld(0, 12, 20),
    ],
    // Low hop Dock A → park platform approach
    [
      toWorld(0, 2, 30),
      toWorld(2, 6, 12),
      toWorld(0, 5, 0),
      toWorld(0, 4, -6),
    ],
  ];

  for (const controls of routeControls) {
    // Ribbons parented under group but path points are world-space for surfing
    // Build ribbon segs in world space by temporarily using world coords as local
    // (skyGroup is under group at origin offset — place ribbons in world via inverse)
    const localControls = controls.map(
      (p) => new THREE.Vector3(p.x - origin.x, p.y - origin.y, p.z - origin.z),
    );
    const localRoute = buildSkyRouteFromControls(localControls, skyGroup, 5.8);
    // Convert path to world for board
    const worldPath = localRoute.path.map(
      (p) => new THREE.Vector3(p.x + origin.x, p.y + origin.y, p.z + origin.z),
    );
    skyRoutes.push({
      path: worldPath,
      pathDist: localRoute.pathDist,
      ribbons: localRoute.ribbons,
    });
  }

  // Gate markers along primary sky lanes (open for surfing)
  const channelPoints = [
    new THREE.Vector3(-10, 6, 18),
    new THREE.Vector3(12, 8, 10),
    new THREE.Vector3(22, 9, -4),
    new THREE.Vector3(-18, 8, -8),
  ];
  for (let i = 0; i < channelPoints.length; i++) {
    const p = channelPoints[i]!;
    const gate = new THREE.Group();
    gate.position.copy(p);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.35), mats.brass);
      post.position.set(s * 5.5, 2.5, 0);
      gate.add(post);
    }
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.12, 6, 20, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x66d8ff,
        emissive: 0x2288cc,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.65,
      }),
    );
    arch.rotation.z = Math.PI / 2;
    arch.position.y = 2.5;
    arch.name = 'channelGate';
    gate.add(arch);
    gate.add(makeLevitator(mats, 0.85));
    group.add(gate);
    freeFloats.push({
      root: gate,
      phase: rng() * Math.PI * 2,
      speed: 0.28,
      ampY: 0.2,
      ampSway: 0.25,
      baseY: p.y,
      basePos: p.clone(),
      boxes: [
        attach(gate, -5.5, 0, 0, 0.5, 5.2, 0.5, 'solid'),
        attach(gate, 5.5, 0, 0, 0.5, 5.2, 0.5, 'solid'),
      ],
    });
  }

  // Free-floating car / fountain near channel (not on platform)
  {
    const car = new THREE.Group();
    car.position.set(8, 3.5, 22);
    addMesh(car, new THREE.BoxGeometry(1.8, 0.9, 3.4), new THREE.MeshStandardMaterial({ color: 0xb05040, metalness: 0.5, roughness: 0.4 }), 0, 0.7, 0);
    addMesh(car, new THREE.BoxGeometry(1.5, 0.6, 1.2), mats.glass, 0, 1.3, 0.5);
    car.add(makeLevitator(mats, 0.85));
    group.add(car);
    freeFloats.push({
      root: car,
      phase: 1.2,
      speed: 0.35,
      ampY: 0.22,
      ampSway: 0.5,
      baseY: 3.5,
      basePos: car.position.clone(),
      boxes: [attach(car, 0, 0.2, 0, 2.0, 1.5, 3.6, 'solid')],
    });
  }

  // Billboard explaining the sample
  {
    const board = new THREE.Group();
    board.position.set(0, 2, 28);
    addMesh(board, new THREE.BoxGeometry(8, 3.2, 0.2), mats.iron, 0, 2, 0);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a2430';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#c4a35a';
    ctx.font = 'bold 28px serif';
    ctx.fillText('SKY DISTRICT · SAMPLE', 40, 50);
    ctx.fillStyle = '#d0d8e0';
    ctx.font = '20px sans-serif';
    const lines = [
      'Walk: docks, bridges, parks, building interiors',
      'Surf: open air channels between platforms',
      'Platforms bob · energy domes hold them aloft',
      'Enter offices, factories, homes, church, school',
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, 40, 100 + i * 32));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 3.0),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    plane.position.set(0, 2, 0.15);
    board.add(plane);
    board.add(makeLevitator(mats, 1.1));
    group.add(board);
    freeFloats.push({
      root: board,
      phase: 0.5,
      speed: 0.22,
      ampY: 0.15,
      ampSway: 0.15,
      baseY: 2,
      basePos: board.position.clone(),
      boxes: [attach(board, 0, 0.5, 0, 8, 3.4, 0.4, 'solid')],
    });
  }

  const colliders: Collider[] = [];
  const floorColliders: Collider[] = [];
  const allBoxes: AttachedBox[] = [];

  function rebuildColliders() {
    colliders.length = 0;
    floorColliders.length = 0;
    allBoxes.length = 0;
    for (const p of platforms) {
      for (const b of p.boxes) allBoxes.push(b);
    }
    for (const f of freeFloats) {
      for (const b of f.boxes) allBoxes.push(b);
    }
    for (const b of allBoxes) {
      const w = attachedToWorld(b);
      // Discard degenerate / insanely fat AABBs (diag rotation leftovers)
      const sx = w.max.x - w.min.x;
      const sy = w.max.y - w.min.y;
      const sz = w.max.z - w.min.z;
      if (sx < 0.02 || sy < 0.02 || sz < 0.02) continue;
      if (b.kind === 'solid' && (sx > 22 || sz > 22) && sy > 2) {
        // Wall AABB should not be a giant cube filling a whole platform
        continue;
      }
      colliders.push(w);
      if (b.kind === 'floor') floorColliders.push(w);
    }
  }

  function animate(time: number, _dt: number) {
    for (const p of platforms) {
      const bob = Math.sin(time * p.speed + p.phase) * p.amp;
      p.root.position.y = p.baseY + bob;
      // Pulse dome + rings
      p.root.traverse((o) => {
        if (o.name === 'domePulse') {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m?.emissiveIntensity != null) {
            m.emissiveIntensity = 0.4 + Math.sin(time * 2.2 + p.phase) * 0.25;
            m.opacity = 0.55 + Math.sin(time * 1.5 + p.phase) * 0.12;
          }
        }
        if (o.name === 'domeCore') {
          o.rotation.y = time * 0.8 + p.phase;
          o.rotation.x = Math.sin(time + p.phase) * 0.3;
        }
        if (o.name.startsWith('energyRing_')) {
          const idx = (o.userData.ringIndex as number) ?? 0;
          const t = (time * 0.45 + p.phase + idx * 0.8) % 2.5;
          const k = t / 2.5;
          o.scale.setScalar(0.7 + k * 1.6);
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) m.opacity = 0.55 * (1 - k);
          o.position.y = -0.35 - k * 1.8;
        }
        if (o.name === 'fountainWater') {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m?.opacity != null) m.opacity = 0.4 + Math.sin(time * 3 + p.phase) * 0.12;
        }
      });
    }
    for (const f of freeFloats) {
      const bob = Math.sin(time * f.speed + f.phase) * f.ampY;
      const sway = Math.sin(time * f.speed * 0.7 + f.phase * 1.3) * f.ampSway * 0.02;
      f.root.position.y = f.baseY + bob;
      f.root.position.x = f.basePos.x + Math.sin(time * 0.3 + f.phase) * f.ampSway * 0.15;
      f.root.position.z = f.basePos.z + Math.cos(time * 0.25 + f.phase) * f.ampSway * 0.12;
      f.root.rotation.z = sway;
      f.root.rotation.x = Math.sin(time * 0.4 + f.phase) * 0.03;
      f.root.traverse((o) => {
        if (o.name === 'leviGlow') {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) m.emissiveIntensity = 0.5 + Math.sin(time * 3 + f.phase) * 0.3;
        }
        if (o.name === 'leviRing') {
          o.scale.setScalar(0.85 + (Math.sin(time * 2 + f.phase) * 0.5 + 0.5) * 0.4);
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) m.opacity = 0.35 + Math.sin(time * 2 + f.phase) * 0.2;
        }
        if (o.name === 'channelGate') {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) m.emissiveIntensity = 0.35 + Math.sin(time * 1.5 + f.phase) * 0.25;
        }
      });
    }
    // Flowing air ribbons — pulse opacity / emissive along the lane
    for (const route of skyRoutes) {
      for (const rib of route.ribbons) {
        const phase = (rib.userData.flowPhase as number) ?? 0;
        const m = (rib as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (!m) continue;
        if (rib.name === 'skyMote') {
          m.opacity = 0.35 + Math.sin(time * 2.5 + phase) * 0.25;
          m.emissiveIntensity = 0.6 + Math.sin(time * 3 + phase) * 0.35;
          rib.position.y += Math.sin(time * 1.8 + phase) * 0.002;
        } else {
          const wave = Math.sin(time * 1.6 + phase) * 0.5 + 0.5;
          m.opacity = rib.name === 'skyRibbonEdge' ? 0.25 + wave * 0.35 : 0.12 + wave * 0.22;
          m.emissiveIntensity = 0.3 + wave * 0.55;
        }
      }
    }
    rebuildColliders();
  }

  rebuildColliders();
  animate(0, 0);

  function sampleFloorY(x: number, z: number, nearY: number): number | null {
    let best: number | null = null;
    let bestDist = 2.8;
    // Only true floor colliders — never snap onto wall AABBs
    for (const c of floorColliders) {
      const top = c.max.y;
      if (x < c.min.x - 0.12 || x > c.max.x + 0.12 || z < c.min.z - 0.12 || z > c.max.z + 0.12) {
        continue;
      }
      const dy = Math.abs(nearY - top);
      if (dy < bestDist && top <= nearY + 1.4 && top >= nearY - 3.5) {
        bestDist = dy;
        best = top;
      }
    }
    return best;
  }

  function lowestContentY(): number {
    let minY = Infinity;
    for (const c of colliders) minY = Math.min(minY, c.min.y);
    for (const route of skyRoutes) {
      for (const p of route.path) minY = Math.min(minY, p.y);
    }
    for (const d of docks) minY = Math.min(minY, d.y);
    if (!Number.isFinite(minY)) minY = origin.y - 4;
    return minY;
  }

  function preferSurfPath(
    pos: THREE.Vector3,
  ): { path: THREE.Vector3[]; pathDist: number[]; lateral: number; yaw: number } | null {
    let best: {
      path: THREE.Vector3[];
      pathDist: number[];
      lateral: number;
      yaw: number;
      score: number;
    } | null = null;

    for (const route of skyRoutes) {
      if (route.path.length < 2) continue;
      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < route.path.length; i++) {
        const d = route.path[i]!.distanceToSquared(pos);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      const a = route.path[bestI]!;
      const b = route.path[Math.min(route.path.length - 1, bestI + 1)]!;
      // Project onto segment for better lateral
      const ab = b.clone().sub(a);
      const abLen = ab.length();
      let t = 0;
      if (abLen > 1e-4) {
        t = THREE.MathUtils.clamp(pos.clone().sub(a).dot(ab) / (abLen * abLen), 0, 1);
      }
      const foot = a.clone().addScaledVector(ab, t);
      const lateral = Math.hypot(pos.x - foot.x, pos.z - foot.z);
      const dy = Math.abs(pos.y - foot.y);
      if (lateral > 32 || dy > 22) continue;
      const yaw = Math.atan2(ab.x, ab.z);
      // Prefer closer lateral + height match
      const score = lateral + dy * 0.55;
      if (!best || score < best.score) {
        best = {
          path: route.path,
          pathDist: route.pathDist,
          lateral,
          yaw,
          score,
        };
      }
    }
    if (!best) return null;
    return {
      path: best.path,
      pathDist: best.pathDist,
      lateral: best.lateral,
      yaw: best.yaw,
    };
  }

  function resolveBoardCollision(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    vy: number,
  ): { pos: THREE.Vector3; vy: number; onGround: boolean } {
    const out = pos.clone();
    let outVy = vy;
    let onGround = false;
    const r = radius;

    // Horizontal push from solids only
    for (const c of colliders) {
      const h = c.max.y - c.min.y;
      const isFloor = c.kind === 'floor' || (c.kind !== 'solid' && h <= 0.55);
      if (isFloor) continue;

      const closestX = Math.max(c.min.x, Math.min(out.x, c.max.x));
      const closestZ = Math.max(c.min.z, Math.min(out.z, c.max.z));
      const dx = out.x - closestX;
      const dz = out.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= r * r || distSq < 1e-10) continue;

      const boardBot = out.y - 0.15;
      const boardTop = out.y + height;
      if (boardTop < c.min.y + 0.05 || boardBot > c.max.y + 0.35) continue;

      // Landing on low solid tops
      if (boardBot <= c.max.y + 0.4 && boardBot >= c.max.y - 0.85 && outVy <= 0.5 && h < 1.2) {
        out.y = c.max.y + 0.22;
        outVy = 0;
        onGround = true;
        continue;
      }

      const dist = Math.sqrt(distSq);
      const pen = r - dist;
      out.x += (dx / dist) * (pen + 0.03);
      out.z += (dz / dist) * (pen + 0.03);
    }

    // Floor snap
    const fy = sampleFloorY(out.x, out.z, out.y);
    if (fy != null && outVy <= 0.4 && out.y <= fy + 1.0 && out.y >= fy - 0.5) {
      out.y = fy + 0.22;
      outVy = 0;
      onGround = true;
    }

    return { pos: out, vy: outVy, onGround };
  }

  return {
    group,
    platforms,
    freeFloats,
    colliders,
    floorColliders,
    docks,
    sampleCenter: origin.clone(),
    skyRoutes,
    animate,
    sampleFloorY,
    resolveBoardCollision,
    preferSurfPath,
    lowestContentY,
  };
}
