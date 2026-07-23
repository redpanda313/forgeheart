/**
 * Sky City hub — market plaza, reef, expandable bay, board shop.
 * Phase 0–2 walk + economy interactables.
 */

import * as THREE from 'three';
import { makeMaterials, type Mats } from './materials';
import type { Collider } from './level';
import { VENDORS, type VendorDef, type CommodityId } from './economy';
import type { HubWaypoints } from './workerAgent';
import { makeSignSprite } from './signLabel';
import { buildFlowerPatchMesh, flowerDisplayName } from './flowers';

export type HubInteractKind =
  | 'vendor'
  | 'harvest'
  | 'flower_pick'
  | 'lease_office'
  | 'parcel_chest'
  | 'craft_bench'
  | 'hire_board'
  | 'robot_broker'
  | 'repair_job'
  | 'board_shop'
  | 'bay_expand'
  | 'invent_desk'
  | 'retail_stall'
  | 'real_estate';

export interface HubInteract {
  id: string;
  kind: HubInteractKind;
  position: THREE.Vector3;
  radius: number;
  mesh: THREE.Object3D;
  vendor?: VendorDef;
  label: string;
  /** Single-type bloom pool for flower_pick */
  harvestPool?: CommodityId[];
  harvestName?: string;
}

export interface MarketHubBuilt {
  group: THREE.Group;
  colliders: Collider[];
  mats: Mats;
  spawn: THREE.Vector3;
  interactables: HubInteract[];
  parcelGroup: THREE.Group;
  /** Expansion pads L2 / L3 — visibility toggled by bay level */
  expandL2: THREE.Group;
  expandL3: THREE.Group;
  harvestSpot: THREE.Vector3;
  waypoints: HubWaypoints;
  workerRoot: THREE.Group;
  /** Player stall visual — toggled when owned */
  stallGroup: THREE.Group;
}

function box(
  _mats: Mats,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): { mesh: THREE.Mesh; col: Collider } {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const col: Collider = {
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    kind: h <= 0.5 ? 'floor' : 'solid',
  };
  // floors: y is center — fix floor colliders to sit on top properly
  if (h <= 0.5) {
    col.min.y = y - h / 2;
    col.max.y = y + h / 2;
    col.kind = 'floor';
  }
  return { mesh, col };
}

function floorSlab(
  _mats: Mats,
  w: number,
  d: number,
  x: number,
  z: number,
  y = 0.12,
  color = 0x5a5348,
): { mesh: THREE.Mesh; col: Collider } {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.65 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const col: Collider = {
    min: new THREE.Vector3(x - w / 2, y - 0.14, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + 0.14, z + d / 2),
    kind: 'floor',
  };
  return { mesh, col };
}

function labelSprite(text: string): THREE.Sprite {
  return makeSignSprite(text, {
    width: 256,
    maxWidth: 640,
    height: 64,
    maxHeight: 180,
    maxFont: 22,
    minFont: 11,
    fontFamily: 'serif',
    fill: 'rgba(20,16,10,0.75)',
    stroke: '#c4a35a',
    textColor: '#f0e0b0',
    worldWidth: 2.8,
    srgb: true,
  });
}

export function buildMarketHub(): MarketHubBuilt {
  const mats = makeMaterials();
  const group = new THREE.Group();
  group.name = 'MarketHub';
  const colliders: Collider[] = [];
  const interactables: HubInteract[] = [];

  const addCol = (c: Collider) => colliders.push(c);
  const addMesh = (m: THREE.Object3D) => group.add(m);

  // ——— Central market plaza (octagon-ish via large circle pad) ———
  {
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(22, 22.5, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a5348, metalness: 0.3, roughness: 0.6 }),
    );
    plaza.position.set(0, 0.15, 0);
    plaza.receiveShadow = true;
    addMesh(plaza);
    addCol({
      min: new THREE.Vector3(-22, 0, -22),
      max: new THREE.Vector3(22, 0.35, 22),
      kind: 'floor',
    });
  }

  // Plaza ring railing (open at +Z for dock approach)
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2 + 0.4;
    if (a0 > 1.2 && a0 < 1.9) continue; // entrance gap
    const x = Math.cos(a0) * 21;
    const z = Math.sin(a0) * 21;
    const p = box(mats, mats.iron, 0.35, 1.0, 0.35, x, 0.7, z);
    addMesh(p.mesh);
    addCol({ ...p.col, kind: 'solid' });
  }

  // Fountain center
  {
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.5, 14),
      mats.brass,
    );
    basin.position.set(0, 0.45, 0);
    addMesh(basin);
    addCol({
      min: new THREE.Vector3(-2.3, 0.2, -2.3),
      max: new THREE.Vector3(2.3, 1.2, 2.3),
      kind: 'solid',
    });
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.15, 14),
      new THREE.MeshStandardMaterial({
        color: 0x4ec8ff,
        transparent: true,
        opacity: 0.65,
        metalness: 0.2,
        roughness: 0.2,
      }),
    );
    water.position.set(0, 0.7, 0);
    addMesh(water);
  }

  // Title arch
  {
    const arch = box(mats, mats.brass, 10, 0.4, 0.5, 0, 4.2, 18);
    addMesh(arch.mesh);
    addCol({ ...arch.col, kind: 'solid' });
    for (const sx of [-1, 1]) {
      const post = box(mats, mats.iron, 0.5, 4, 0.5, sx * 5, 2.2, 18);
      addMesh(post.mesh);
      addCol({ ...post.col, kind: 'solid' });
    }
    const title = labelSprite('SKY MARKET · PHASE 0');
    title.position.set(0, 5.0, 18);
    addMesh(title);
  }

  // Vendor stalls around plaza
  const stallAngles = [
    { a: -0.9, v: 0 },
    { a: -0.3, v: 1 },
    { a: 0.3, v: 2 },
    { a: 0.9, v: 3 },
  ];
  for (const { a, v } of stallAngles) {
    const vendor = VENDORS[v]!;
    const x = Math.cos(a) * 12;
    const z = Math.sin(a) * 12;
    const yaw = a + Math.PI;

    // Stall floor
    const pad = floorSlab(mats, 5, 4, x, z, 0.2, 0x6a5f4e);
    addMesh(pad.mesh);
    addCol(pad.col);

    // Counter
    const counter = box(mats, mats.wood, 3.5, 1.0, 0.7, x + Math.sin(yaw) * 0.8, 0.7, z + Math.cos(yaw) * 0.8);
    counter.mesh.rotation.y = yaw;
    addMesh(counter.mesh);
    addCol({
      min: new THREE.Vector3(x - 2, 0.2, z - 1.2),
      max: new THREE.Vector3(x + 2, 1.3, z + 1.2),
      kind: 'solid',
    });

    // Awning
    const awn = box(mats, mats.copper, 4, 0.12, 3, x, 2.4, z);
    addMesh(awn.mesh);

    // Vendor mannequin (simple)
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.8 }),
    );
    body.position.set(x - Math.sin(yaw) * 1.2, 1.2, z - Math.cos(yaw) * 1.2);
    addMesh(body);

    const spr = labelSprite(vendor.name);
    spr.position.set(x, 2.9, z);
    addMesh(spr);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xc4a35a,
        emissive: 0x886622,
        emissiveIntensity: 0.4,
      }),
    );
    marker.position.set(x + Math.sin(yaw) * 1.5, 1.1, z + Math.cos(yaw) * 1.5);
    addMesh(marker);

    interactables.push({
      id: vendor.id,
      kind: 'vendor',
      position: marker.position.clone(),
      radius: 2.2,
      mesh: marker,
      vendor,
      label: `${vendor.title} · ${vendor.name}`,
    });
  }

  // ——— Dock approach (+Z) ———
  {
    const dock = floorSlab(mats, 14, 16, 0, 30, 0.15, 0x555048);
    addMesh(dock.mesh);
    addCol(dock.col);
    const bridge = floorSlab(mats, 6, 10, 0, 22, 0.15);
    addMesh(bridge.mesh);
    addCol(bridge.col);
    // Energy dome under dock (visual)
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x4a80a0,
        emissive: 0x2288cc,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    dome.rotation.x = Math.PI;
    dome.position.set(0, 0, 30);
    addMesh(dome);
    const dockLabel = labelSprite('ARRIVAL DOCK');
    dockLabel.position.set(0, 3, 36);
    addMesh(dockLabel);
  }

  // ——— Harvest reef pad (−X) ———
  const harvestSpot = new THREE.Vector3(-38, 0.5, 0);
  {
    const reef = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10.5, 0.45, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a5a48, metalness: 0.2, roughness: 0.7 }),
    );
    reef.position.set(-38, 0.15, 0);
    reef.receiveShadow = true;
    addMesh(reef);
    addCol({
      min: new THREE.Vector3(-48, 0, -10),
      max: new THREE.Vector3(-28, 0.4, 10),
      kind: 'floor',
    });
    // Bridge to plaza
    const br = floorSlab(mats, 14, 5, -28, 0, 0.15);
    addMesh(br.mesh);
    addCol(br.col);

    // Ore nodes (visual)
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const ox = -38 + Math.cos(ang) * 4;
      const oz = Math.sin(ang) * 4;
      const node = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: 0x8a9aaa,
          metalness: 0.6,
          roughness: 0.4,
          emissive: 0x334455,
          emissiveIntensity: 0.3,
        }),
      );
      node.position.set(ox, 0.7, oz);
      addMesh(node);
    }

    const hMark = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.08, 6, 16),
      new THREE.MeshStandardMaterial({
        color: 0x66d8ff,
        emissive: 0x2288cc,
        emissiveIntensity: 0.6,
      }),
    );
    hMark.rotation.x = Math.PI / 2;
    hMark.position.copy(harvestSpot);
    hMark.position.y = 0.5;
    addMesh(hMark);

    const hLab = labelSprite('CLOUD REEF · E harvest');
    hLab.position.set(-38, 2.8, 0);
    addMesh(hLab);

    interactables.push({
      id: 'harvest',
      kind: 'harvest',
      position: harvestSpot.clone(),
      radius: 3.5,
      mesh: hMark,
      label: 'Cloud Reef — extract resources',
    });
  }

  // ——— Training plaza flower patch (personality ingredient intro) ———
  {
    const flowerId = 'bloom_sky' as const;
    // SW plaza edge — clear of vendors (+X), reef (−X), bay (−Z), dock (+Z)
    const fx = -12;
    const fz = 8;
    const patch = buildFlowerPatchMesh(flowerId, { seed: 42, count: 6, scale: 1.15 });
    patch.position.set(fx, 0, fz);
    addMesh(patch);
    const fname = flowerDisplayName(flowerId);
    const fLab = labelSprite(`${fname.toUpperCase()} · E pick`);
    fLab.position.set(fx, 1.9, fz);
    addMesh(fLab);
    interactables.push({
      id: 'flowers_training',
      kind: 'flower_pick',
      position: new THREE.Vector3(fx, 0.5, fz),
      radius: 2.8,
      mesh: patch,
      label: `Pick ${fname} (personality for frames)`,
      harvestPool: [flowerId],
      harvestName: fname,
    });
  }

  // ——— Lease office (+X / +Z of plaza) + walkway from plaza ———
  {
    // Path plaza edge → lease (northeast): was a gap past r≈22 plaza
    const leasePath1 = floorSlab(mats, 10, 5, 18, 6, 0.15, 0x5a564c);
    addMesh(leasePath1.mesh);
    addCol(leasePath1.col);
    const leasePath2 = floorSlab(mats, 8, 5, 24, 8, 0.15, 0x5a564c);
    addMesh(leasePath2.mesh);
    addCol(leasePath2.col);
    // Open approach pad in front of the office (south of walls)
    const approach = floorSlab(mats, 8, 4, 28, 5, 0.16, 0x5a5348);
    addMesh(approach.mesh);
    addCol(approach.col);

    const office = floorSlab(mats, 8, 8, 28, 8, 0.18, 0x6a5f4e);
    addMesh(office.mesh);
    addCol(office.col);
    // Back + side walls only — open south toward plaza path
    const walls = [
      box(mats, mats.brass, 8, 3, 0.3, 28, 1.7, 12), // north back wall
      box(mats, mats.brass, 0.3, 3, 8, 24, 1.7, 8),
      box(mats, mats.brass, 0.3, 3, 8, 32, 1.7, 8),
    ];
    for (const w of walls) {
      addMesh(w.mesh);
      addCol({ ...w.col, kind: 'solid' });
    }
    // Desk
    const desk = box(mats, mats.wood, 3, 0.9, 1.2, 28, 0.7, 9);
    addMesh(desk.mesh);
    addCol({ ...desk.col, kind: 'solid' });

    const clerk = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.85, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xb8923a, roughness: 0.7 }),
    );
    clerk.position.set(28, 1.15, 10.2);
    addMesh(clerk);

    const lmark = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x82e0aa,
        emissive: 0x228844,
        emissiveIntensity: 0.5,
      }),
    );
    lmark.position.set(28, 1.2, 6.2);
    addMesh(lmark);
    const ll = labelSprite('LEASE OFFICE · 25 brass');
    ll.position.set(28, 3.2, 8);
    addMesh(ll);
    const leaseArrow = labelSprite('→ LEASE OFFICE');
    leaseArrow.position.set(14, 2.2, 5);
    addMesh(leaseArrow);

    interactables.push({
      id: 'lease',
      kind: 'lease_office',
      position: lmark.position.clone(),
      radius: 2.5,
      mesh: lmark,
      label: 'Lease Starter Bay (25 brass)',
    });
  }

  // ——— Starter parcel (−Z) ———
  const parcelGroup = new THREE.Group();
  parcelGroup.name = 'StarterParcel';
  parcelGroup.position.set(0, 0, -36);
  {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9.2, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a5348, metalness: 0.3, roughness: 0.65 }),
    );
    pad.position.y = 0.15;
    pad.receiveShadow = true;
    parcelGroup.add(pad);
    colliders.push({
      min: new THREE.Vector3(-9, 0, -45),
      max: new THREE.Vector3(9, 0.35, -27),
      kind: 'floor',
    });

    // Bridge plaza → bay / workbench (wider solid walkway)
    const br = floorSlab(mats, 7, 14, 0, -26, 0.15, 0x5a564c);
    addMesh(br.mesh);
    addCol(br.col);
    const br2 = floorSlab(mats, 6, 6, 0, -20, 0.15, 0x5a5348);
    addMesh(br2.mesh);
    addCol(br2.col);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), mats.wood);
    chest.position.set(0, 0.6, 0);
    parcelGroup.add(chest);

    const workbench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 1.2), mats.iron);
    workbench.position.set(-3, 0.65, 2);
    parcelGroup.add(workbench);
    // Anvil accent
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.6), mats.brass);
    anvil.position.set(-3, 1.25, 2);
    parcelGroup.add(anvil);

    const sign = labelSprite('YOUR STARTER BAY');
    sign.position.set(0, 2.5, 4);
    parcelGroup.add(sign);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x4a80a0,
        emissive: 0x2288cc,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    dome.rotation.x = Math.PI;
    dome.position.y = 0;
    parcelGroup.add(dome);

    group.add(parcelGroup);

    const pMark = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xaa8800,
        emissiveIntensity: 0.4,
      }),
    );
    pMark.position.set(0, 1.2, -36);
    addMesh(pMark);

    interactables.push({
      id: 'parcel',
      kind: 'parcel_chest',
      position: new THREE.Vector3(0, 1, -36),
      radius: 2.5,
      mesh: pMark,
      label: 'Bay office — inventory & workers (I)',
    });

    // Craft bench interact
    const craftMark = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x66ccff,
        emissive: 0x2288aa,
        emissiveIntensity: 0.55,
      }),
    );
    craftMark.position.set(-3, 1.5, -34);
    addMesh(craftMark);
    const craftLab = labelSprite('WORKBENCH · E craft');
    craftLab.position.set(-3, 2.6, -34);
    addMesh(craftLab);
    interactables.push({
      id: 'craft',
      kind: 'craft_bench',
      position: craftMark.position.clone(),
      radius: 2.4,
      mesh: craftMark,
      label: 'Workbench — craft & assemble',
    });
  }

  // ——— Bay expansion pads (west of starter) ———
  const expandL2 = new THREE.Group();
  expandL2.name = 'BayExpandL2';
  expandL2.visible = false;
  {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7.2, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a5548, metalness: 0.25, roughness: 0.7 }),
    );
    pad.position.set(-14, 0.12, -36);
    expandL2.add(pad);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 3.5), mats.wood);
    shed.position.set(-14, 1.3, -36);
    expandL2.add(shed);
    const lab = labelSprite('EXPANDED PAD');
    lab.position.set(-14, 3.2, -33);
    expandL2.add(lab);
    group.add(expandL2);
    colliders.push({
      min: new THREE.Vector3(-21, 0, -43),
      max: new THREE.Vector3(-7, 0.3, -29),
      kind: 'floor',
    });
  }

  const expandL3 = new THREE.Group();
  expandL3.name = 'BayExpandL3';
  expandL3.visible = false;
  {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a4858, metalness: 0.35, roughness: 0.55 }),
    );
    pad.position.set(12, 0.12, -40);
    expandL3.add(pad);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), mats.iron);
    wing.position.set(12, 1.7, -40);
    expandL3.add(wing);
    const lab = labelSprite('WORKSHOP WING');
    lab.position.set(12, 3.8, -36);
    expandL3.add(lab);
    // Invent desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), mats.brass);
    desk.position.set(10, 0.7, -37);
    expandL3.add(desk);
    group.add(expandL3);
    colliders.push({
      min: new THREE.Vector3(6, 0, -45),
      max: new THREE.Vector3(18, 0.3, -35),
      kind: 'floor',
    });
  }

  // Expand purchase marker (near lease / bay)
  {
    const em = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x88dd88,
        emissive: 0x228822,
        emissiveIntensity: 0.45,
      }),
    );
    em.position.set(4, 1.3, -32);
    addMesh(em);
    const el = labelSprite('EXPAND BAY · lease office also');
    el.position.set(4, 2.6, -32);
    addMesh(el);
    interactables.push({
      id: 'expand',
      kind: 'bay_expand',
      position: em.position.clone(),
      radius: 2.3,
      mesh: em,
      label: 'Expand bay (or Lease Office)',
    });
  }

  // Invent desk interact (usable at bay L3)
  {
    const im = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xdda0ff,
        emissive: 0x6622aa,
        emissiveIntensity: 0.5,
      }),
    );
    im.position.set(10, 1.3, -37);
    addMesh(im);
    const il = labelSprite('INVENT DESK · new recipes');
    il.position.set(10, 2.7, -37);
    addMesh(il);
    interactables.push({
      id: 'invent',
      kind: 'invent_desk',
      position: im.position.clone(),
      radius: 2.4,
      mesh: im,
      label: 'Invent desk (Workshop Wing)',
    });
  }

  // ——— Hire board / worker post (near lease) + walkway from plaza & lease path ———
  {
    // Plaza → hire post (northeast corner past railing)
    const hirePath1 = floorSlab(mats, 8, 5, 16, 12, 0.15, 0x5a564c);
    addMesh(hirePath1.mesh);
    addCol(hirePath1.col);
    // Link from lease approach → hire board
    const hirePath2 = floorSlab(mats, 6, 5, 24, 12, 0.15, 0x5a564c);
    addMesh(hirePath2.mesh);
    addCol(hirePath2.col);
    const hirePad = floorSlab(mats, 6, 6, 22, 14, 0.16, 0x5a5348);
    addMesh(hirePad.mesh);
    addCol(hirePad.col);

    const board = box(mats, mats.wood, 2.2, 2.8, 0.15, 22, 1.8, 14);
    addMesh(board.mesh);
    addCol({ ...board.col, kind: 'solid' });
    const hm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe8a060,
        emissive: 0xaa5522,
        emissiveIntensity: 0.45,
      }),
    );
    hm.position.set(22, 1.3, 13);
    addMesh(hm);
    const hl = labelSprite('HIRE · jobs · equip');
    hl.position.set(22, 3.4, 14);
    addMesh(hl);
    const hireArrow = labelSprite('→ WORK POST · HIRE');
    hireArrow.position.set(14, 2.2, 10);
    addMesh(hireArrow);
    interactables.push({
      id: 'hire',
      kind: 'hire_board',
      position: hm.position.clone(),
      radius: 2.3,
      mesh: hm,
      label: 'Hire / assign jobs / equip workers',
    });
  }

  // ——— Board shop (dock east) + walkway from dock/plaza ———
  {
    const boardPath = floorSlab(mats, 6, 8, 10, 24, 0.15, 0x5a564c);
    addMesh(boardPath.mesh);
    addCol(boardPath.col);
    const pad = floorSlab(mats, 7, 7, 12, 28, 0.16, 0x4a5868);
    addMesh(pad.mesh);
    addCol(pad.col);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.4), mats.iron);
    rack.position.set(12, 0.9, 28);
    addMesh(rack);
    const boardVis = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x44ccee,
        emissive: 0x2288aa,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.35,
      }),
    );
    boardVis.position.set(12, 1.5, 28);
    boardVis.rotation.z = 0.3;
    addMesh(boardVis);
    const bm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x66e0ff,
        emissive: 0x2288cc,
        emissiveIntensity: 0.5,
      }),
    );
    bm.position.set(12, 1.2, 26.5);
    addMesh(bm);
    const bl = labelSprite('BOARD SHOP · buy / upgrade');
    bl.position.set(12, 2.9, 28);
    addMesh(bl);
    interactables.push({
      id: 'boardshop',
      kind: 'board_shop',
      position: bm.position.clone(),
      radius: 2.5,
      mesh: bm,
      label: 'Board shop — chassis & upgrades',
    });
  }

  // ——— Robot broker (buys frames) + walkway from plaza ———
  {
    const brokerPath = floorSlab(mats, 8, 5, 14, -6, 0.15, 0x5a564c);
    addMesh(brokerPath.mesh);
    addCol(brokerPath.col);
    const pad = floorSlab(mats, 6, 6, 18, -8, 0.18, 0x5a4a40);
    addMesh(pad.mesh);
    addCol(pad.col);
    const bot = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.8, 0.9),
      mats.iron,
    );
    bot.position.set(18, 1.1, -8);
    addMesh(bot);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mats.brass);
    head.position.set(18, 2.2, -8);
    addMesh(head);
    const bm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xaa88ff,
        emissive: 0x5533aa,
        emissiveIntensity: 0.5,
      }),
    );
    bm.position.set(18, 1.2, -6.2);
    addMesh(bm);
    const bl = labelSprite('FRAME BROKER · sell robots');
    bl.position.set(18, 3.2, -8);
    addMesh(bl);
    interactables.push({
      id: 'broker',
      kind: 'robot_broker',
      position: bm.position.clone(),
      radius: 2.5,
      mesh: bm,
      label: 'Sell Basic Robot Frame (75 brass)',
    });
  }

  // ——— Broken robot (repair job) + walkway from plaza ———
  {
    const repairPath = floorSlab(mats, 8, 5, -14, 10, 0.15, 0x5a564c);
    addMesh(repairPath.mesh);
    addCol(repairPath.col);
    const pad = floorSlab(mats, 5, 5, -18, 14, 0.16, 0x4a4540);
    addMesh(pad.mesh);
    addCol(pad.col);
    const husk = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.9, 1.4),
      mats.ironDark,
    );
    husk.position.set(-18, 0.7, 14);
    husk.rotation.z = 0.4;
    addMesh(husk);
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffaa44,
        emissive: 0xff6600,
        emissiveIntensity: 0.8,
      }),
    );
    spark.position.set(-17.5, 1.1, 14.2);
    spark.name = 'repairSpark';
    addMesh(spark);
    const rm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff8866,
        emissive: 0xcc4422,
        emissiveIntensity: 0.45,
      }),
    );
    rm.position.set(-18, 1.2, 12.5);
    addMesh(rm);
    const rl = labelSprite('REPAIR JOB · needs kit');
    rl.position.set(-18, 2.8, 14);
    addMesh(rl);
    interactables.push({
      id: 'repair',
      kind: 'repair_job',
      position: rm.position.clone(),
      radius: 2.4,
      mesh: rm,
      label: 'Field repair (needs Repair Kit)',
    });
  }

  // Ambient pillars
  for (const [x, z] of [
    [-16, -16],
    [16, -16],
    [-16, 16],
    [16, 12],
  ]) {
    const p = box(mats, mats.brass, 1.2, 6, 1.2, x, 3.2, z);
    addMesh(p.mesh);
    addCol({ ...p.col, kind: 'solid' });
  }

  // Spawn on dock facing market
  const spawn = new THREE.Vector3(0, 1.55, 34);

  // Welcome sign
  const welcome = labelSprite('TRAINING MARKET · earn 1000 brass · buy apartment');
  welcome.position.set(0, 2.5, 32);
  addMesh(welcome);

  // ——— Real-estate office (+X) + walkway from plaza ———
  {
    // Pathway plaza → RE (east)
    const path1 = floorSlab(mats, 16, 5, 18, 0, 0.15, 0x5a564c);
    addMesh(path1.mesh);
    addCol(path1.col);
    const path2 = floorSlab(mats, 12, 6, 32, 0, 0.15, 0x5a564c);
    addMesh(path2.mesh);
    addCol(path2.col);
    // Approach pad
    const pad = floorSlab(mats, 14, 12, 42, 0, 0.16, 0x4a5560);
    addMesh(pad.mesh);
    addCol(pad.col);

    // Building mass
    const facade = box(mats, mats.iron, 10, 7, 8, 42, 3.6, 0);
    addMesh(facade.mesh);
    addCol({ ...facade.col, kind: 'solid' });
    const roof = box(mats, mats.brass, 11, 0.5, 9, 42, 7.3, 0);
    addMesh(roof.mesh);
    // Columns
    for (const dz of [-3, 3]) {
      const col = box(mats, mats.brass, 0.7, 5, 0.7, 36.5, 2.6, dz);
      addMesh(col.mesh);
      addCol({ ...col.col, kind: 'solid' });
    }
    // Door recess (visual)
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.2, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0x2a3540,
        metalness: 0.4,
        roughness: 0.5,
        emissive: 0x114466,
        emissiveIntensity: 0.35,
      }),
    );
    door.position.set(36.8, 1.8, 0);
    addMesh(door);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x66aacc,
        emissive: 0x226688,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    dome.position.set(42, 7.2, 0);
    addMesh(dome);

    const reLab = labelSprite('SKY REAL ESTATE · apartments');
    reLab.position.set(38, 5.2, 0);
    addMesh(reLab);
    const reLab2 = labelSprite('1000 BRASS · starter sky flat');
    reLab2.position.set(38, 4.4, 0);
    addMesh(reLab2);

    // Path wayfinding signs
    const arrow1 = labelSprite('→ REAL ESTATE');
    arrow1.position.set(10, 2.2, 2.5);
    addMesh(arrow1);
    const arrow2 = labelSprite('→ APARTMENTS');
    arrow2.position.set(28, 2.2, 2.5);
    addMesh(arrow2);

    const rm = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0x4488cc,
        emissiveIntensity: 0.55,
      }),
    );
    rm.position.set(37.5, 1.3, 0);
    addMesh(rm);
    interactables.push({
      id: 'realestate',
      kind: 'real_estate',
      position: rm.position.clone(),
      radius: 2.8,
      mesh: rm,
      label: 'Sky Real Estate — buy apartment (1000 brass)',
    });
  }

  // ——— Player retail stall (plaza south edge) ———
  const stallGroup = new THREE.Group();
  stallGroup.name = 'PlayerStall';
  stallGroup.visible = false;
  {
    const pad = floorSlab(mats, 5.5, 4.5, -8, 10, 0.18, 0x6a5848);
    stallGroup.add(pad.mesh);
    colliders.push(pad.col);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.7), mats.wood);
    counter.position.set(-8, 0.7, 10.5);
    stallGroup.add(counter);
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.12, 3.2),
      new THREE.MeshStandardMaterial({
        color: 0xc45a3a,
        emissive: 0x662211,
        emissiveIntensity: 0.25,
      }),
    );
    awn.position.set(-8, 2.35, 10);
    stallGroup.add(awn);
    const sign = labelSprite('YOUR STALL');
    sign.position.set(-8, 3.1, 10);
    stallGroup.add(sign);
    group.add(stallGroup);
  }
  {
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff8866,
        emissive: 0xaa4422,
        emissiveIntensity: 0.5,
      }),
    );
    sm.position.set(-8, 1.2, 8.8);
    addMesh(sm);
    const sl = labelSprite('RETAIL STALL · lease / manage');
    sl.position.set(-8, 2.7, 9);
    addMesh(sl);
    interactables.push({
      id: 'stall',
      kind: 'retail_stall',
      position: sm.position.clone(),
      radius: 2.5,
      mesh: sm,
      label: 'Your retail stall',
    });
  }

  const workerRoot = new THREE.Group();
  workerRoot.name = 'WorkerRoot';
  group.add(workerRoot);

  const waypoints: HubWaypoints = {
    bay: new THREE.Vector3(0, 0, -36),
    reef: harvestSpot.clone(),
    broker: new THREE.Vector3(18, 0, -7),
    repair: new THREE.Vector3(-18, 0, 13),
    craft: new THREE.Vector3(-3, 0, -34),
    market: new THREE.Vector3(0, 0, 0),
    stall: new THREE.Vector3(-8, 0, 10),
  };
  // Vendor stalls for worker market buy/sell programs
  for (const it of interactables) {
    if (it.kind === 'vendor' && it.vendor) {
      waypoints[`vendor_${it.vendor.id}`] = it.position.clone().setY(0);
    }
  }

  return {
    group,
    colliders,
    mats,
    spawn,
    interactables,
    parcelGroup,
    expandL2,
    expandL3,
    harvestSpot,
    waypoints,
    workerRoot,
    stallGroup,
  };
}
