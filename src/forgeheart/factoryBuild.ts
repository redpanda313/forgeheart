/**
 * Factory / bonded-storage builds — industrial forms, not shop cosmetics.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { Collider } from './level';
import type { FactoryForm, FactoryLayout, SiteProp } from './economy';

export const FACTORY_FORMS: {
  id: FactoryForm;
  name: string;
  blurb: string;
  extraCost: number;
}[] = [
  {
    id: 'horizontal',
    name: 'Horizontal works',
    blurb: 'Wide low hall · easy loading',
    extraCost: 0,
  },
  {
    id: 'tall',
    name: 'Tall stack house',
    blurb: 'Vertical tower · smokestack',
    extraCost: 110,
  },
  {
    id: 'boiler_yard',
    name: 'Boiler yard',
    blurb: 'Open pad · cylinder boilers',
    extraCost: 160,
  },
];

export const FACTORY_PROP_CATALOG: {
  id: string;
  name: string;
  blurb: string;
  cost: number;
}[] = [
  { id: 'pipe_run', name: 'Pipe run', blurb: 'Elbowed conduits', cost: 45 },
  { id: 'gear_stack', name: 'Gear stack', blurb: 'Brass gear piles', cost: 55 },
  { id: 'cylinder_boiler', name: 'Cylinder boiler', blurb: 'Pressurized tank', cost: 120 },
  { id: 'smokestack', name: 'Smokestack', blurb: 'Tall exhaust', cost: 90 },
  { id: 'valve_rack', name: 'Valve rack', blurb: 'Control manifold', cost: 40 },
  { id: 'conduit', name: 'Conduit trunk', blurb: 'Cable trough', cost: 50 },
  { id: 'crane_arm', name: 'Crane arm', blurb: 'Yard hoist', cost: 110 },
];

export function factoryFormExtra(form: FactoryForm): number {
  return FACTORY_FORMS.find((f) => f.id === form)?.extraCost ?? 0;
}

export function factoryPropCost(id: string): number {
  return FACTORY_PROP_CATALOG.find((p) => p.id === id)?.cost ?? 45;
}

export function sumFactoryPropsCost(props: SiteProp[]): number {
  let n = 0;
  for (const p of props) n += factoryPropCost(p.id);
  return n;
}

export function defaultFactoryLayout(x = 0, z = 0): FactoryLayout {
  return {
    plotX: x,
    plotZ: z,
    yaw: 0,
    form: 'horizontal',
    props: [],
    built: false,
  };
}

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
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
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

function addFactoryProp(
  g: THREE.Group,
  id: string,
  lx: number,
  lz: number,
  yaw: number,
  iron: THREE.Material,
  brass: THREE.Material,
) {
  const root = new THREE.Group();
  root.position.set(lx, 0, lz);
  root.rotation.y = yaw;
  if (id === 'pipe_run') {
    root.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), iron, 0, 1.0, 0));
    const elbow = mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 8), iron, 0.5, 2.0, 0);
    elbow.rotation.z = Math.PI / 2;
    root.add(elbow);
  } else if (id === 'gear_stack') {
    for (let i = 0; i < 3; i++) {
      const gear = mesh(new THREE.CylinderGeometry(0.45 - i * 0.05, 0.45 - i * 0.05, 0.18, 12), brass, 0, 0.25 + i * 0.22, 0);
      gear.rotation.x = Math.PI / 2;
      root.add(gear);
    }
  } else if (id === 'cylinder_boiler') {
    root.add(mesh(new THREE.CylinderGeometry(0.85, 0.95, 2.4, 12), brass, 0, 1.25, 0));
    root.add(box(iron, 0.2, 0.5, 0.2, 0.5, 2.6, 0));
  } else if (id === 'smokestack') {
    root.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 10), iron, 0, 2.2, 0));
    root.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 10), brass, 0, 4.3, 0));
  } else if (id === 'valve_rack') {
    root.add(box(iron, 1.2, 1.0, 0.4, 0, 0.7, 0));
    for (const sx of [-0.35, 0, 0.35]) {
      root.add(mesh(new THREE.SphereGeometry(0.12, 8, 8), brass, sx, 1.25, 0.15));
    }
  } else if (id === 'conduit') {
    root.add(box(iron, 2.2, 0.35, 0.45, 0, 0.9, 0));
    root.add(box(brass, 0.3, 0.9, 0.3, -0.9, 0.55, 0));
    root.add(box(brass, 0.3, 0.9, 0.3, 0.9, 0.55, 0));
  } else if (id === 'crane_arm') {
    root.add(box(iron, 0.35, 3.2, 0.35, 0, 1.7, 0));
    root.add(box(brass, 2.8, 0.22, 0.22, 1.2, 3.1, 0));
    root.add(box(iron, 0.15, 1.2, 0.15, 2.4, 2.4, 0));
  } else {
    root.add(box(iron, 0.6, 0.6, 0.6, 0, 0.35, 0));
  }
  g.add(root);
}

export function makeFactoryPropGhost(id: string, mats: Mats): THREE.Group {
  const iron = mats.iron.clone();
  iron.transparent = true;
  iron.opacity = 0.65;
  iron.depthWrite = false;
  const brass = mats.brass.clone();
  brass.transparent = true;
  brass.opacity = 0.65;
  brass.depthWrite = false;
  const g = new THREE.Group();
  addFactoryProp(g, id, 0, 0, 0, iron, brass);
  return g;
}

export type FactoryVisualBuilt = {
  group: THREE.Group;
  colliders: Collider[];
  interactLocal: THREE.Vector3;
};

export function buildFactoryVisual(mats: Mats, layout: FactoryLayout): FactoryVisualBuilt {
  const g = new THREE.Group();
  g.name = 'PlayerFactoryBuild';
  const cols: Collider[] = [];
  const iron = mats.iron;
  const brass = mats.brass;
  const ironDark = mats.ironDark;

  const form = layout.form;
  let interactLocal = new THREE.Vector3(0, 1.2, 4);

  if (form === 'horizontal') {
    const w = 12;
    const d = 8;
    const h = 4.2;
    g.add(box(iron, w, 0.25, d, 0, 0.12, 0));
    cols.push({
      min: new THREE.Vector3(-w / 2, 0, -d / 2),
      max: new THREE.Vector3(w / 2, 0.25, d / 2),
      kind: 'floor',
    });
    // Back + sides
    g.add(box(iron, w, h, 0.35, 0, h / 2, -d / 2));
    cols.push({
      min: new THREE.Vector3(-w / 2, 0, -d / 2 - 0.2),
      max: new THREE.Vector3(w / 2, h, -d / 2 + 0.2),
      kind: 'solid',
    });
    for (const sx of [-1, 1]) {
      g.add(box(iron, 0.35, h, d, (sx * w) / 2, h / 2, 0));
      cols.push({
        min: new THREE.Vector3(sx * w / 2 - 0.2, 0, -d / 2),
        max: new THREE.Vector3(sx * w / 2 + 0.2, h, d / 2),
        kind: 'solid',
      });
    }
    // Front with door gap
    const doorW = 3.8;
    const sideW = (w - doorW) / 2;
    for (const sx of [-1, 1]) {
      const cx = sx * (doorW / 2 + sideW / 2);
      g.add(box(iron, sideW, h, 0.35, cx, h / 2, d / 2));
    }
    g.add(box(brass, doorW + 0.2, 0.35, 0.4, 0, h - 0.25, d / 2));
    // Roof strips
    for (let i = 0; i < 3; i++) {
      g.add(box(ironDark, w / 3 - 0.1, 0.5, d, -w / 3 + i * (w / 3), h + 0.2, 0));
    }
    // Built-in pipe + gear
    g.add(mesh(new THREE.CylinderGeometry(0.9, 1.0, 2.2, 12), brass, -3.2, 1.2, -1.5));
    g.add(box(iron, 1.8, 1.0, 1.0, 3.2, 0.7, -1.2));
    interactLocal = new THREE.Vector3(0, 1.2, d / 2 + 0.8);
  } else if (form === 'tall') {
    const w = 7;
    const d = 7;
    const h = 9;
    g.add(box(iron, w, 0.25, d, 0, 0.12, 0));
    cols.push({
      min: new THREE.Vector3(-w / 2, 0, -d / 2),
      max: new THREE.Vector3(w / 2, 0.25, d / 2),
      kind: 'floor',
    });
    g.add(box(iron, w * 0.85, h, d * 0.85, 0, h / 2, 0));
    cols.push({
      min: new THREE.Vector3(-w * 0.4, 0, -d * 0.4),
      max: new THREE.Vector3(w * 0.4, h, d * 0.4),
      kind: 'solid',
    });
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 5.5, 10), ironDark, 2.2, 5.5, -2.0));
    g.add(box(brass, 2.4, 0.3, 0.3, 0, 3.2, d * 0.42));
    g.add(box(brass, 2.4, 0.3, 0.3, 0, 6.0, d * 0.42));
    interactLocal = new THREE.Vector3(0, 1.2, d / 2 + 0.6);
  } else {
    // boiler_yard
    const w = 14;
    const d = 11;
    g.add(box(ironDark, w, 0.2, d, 0, 0.1, 0));
    cols.push({
      min: new THREE.Vector3(-w / 2, 0, -d / 2),
      max: new THREE.Vector3(w / 2, 0.2, d / 2),
      kind: 'floor',
    });
    // Shed office
    g.add(box(iron, 4.5, 3.2, 3.5, -4, 1.7, -3));
    cols.push({
      min: new THREE.Vector3(-6.3, 0, -4.8),
      max: new THREE.Vector3(-1.7, 3.2, -1.2),
      kind: 'solid',
    });
    // Twin boilers
    for (const sx of [-1.5, 2.5]) {
      g.add(mesh(new THREE.CylinderGeometry(1.3, 1.45, 3.2, 14), brass, sx, 1.7, 1.5));
      cols.push({
        min: new THREE.Vector3(sx - 1.4, 0, 0.1),
        max: new THREE.Vector3(sx + 1.4, 3.2, 2.9),
        kind: 'solid',
      });
    }
    // Connecting pipes
    const pipe = mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 8), iron, 0.5, 2.8, 1.5);
    pipe.rotation.z = Math.PI / 2;
    g.add(pipe);
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 4.5, 10), ironDark, 5.2, 2.4, -2.5));
    interactLocal = new THREE.Vector3(-4, 1.2, -0.5);
  }

  for (const p of layout.props ?? []) {
    addFactoryProp(g, p.id, p.lx, p.lz, p.yaw, iron, brass);
  }

  return { group: g, colliders: cols, interactLocal };
}

export function worldFactoryColliders(
  built: FactoryVisualBuilt,
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
