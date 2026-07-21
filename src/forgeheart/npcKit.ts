/**
 * Roblox-style blocky characters — readable silhouettes, appealing faces.
 * Shared geos; per-instance materials for palette variety.
 */

import * as THREE from 'three';
import type { Mats } from './materials';

export type NpcVisualRole =
  | 'resident'
  | 'flyer'
  | 'vendor'
  | 'girl'
  | 'robot_helper'
  | 'rogue'
  | 'shopkeeper';

const GEO = {
  torso: new THREE.BoxGeometry(0.55, 0.62, 0.32),
  hip: new THREE.BoxGeometry(0.5, 0.22, 0.3),
  head: new THREE.BoxGeometry(0.42, 0.42, 0.42),
  limb: new THREE.BoxGeometry(0.16, 0.5, 0.16),
  hand: new THREE.BoxGeometry(0.14, 0.14, 0.14),
  foot: new THREE.BoxGeometry(0.18, 0.12, 0.28),
  hair: new THREE.BoxGeometry(0.46, 0.22, 0.46),
  hatBrim: new THREE.CylinderGeometry(0.32, 0.32, 0.04, 10),
  hatTop: new THREE.CylinderGeometry(0.2, 0.22, 0.2, 8),
  board: new THREE.BoxGeometry(0.42, 0.08, 1.15),
  fin: new THREE.BoxGeometry(0.06, 0.2, 0.24),
  skirt: new THREE.BoxGeometry(0.58, 0.35, 0.36),
  medal: new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10),
  eye: new THREE.BoxGeometry(0.08, 0.08, 0.04),
  smile: new THREE.BoxGeometry(0.16, 0.04, 0.03),
};

type Palette = {
  skin: number;
  shirt: number;
  pants: number;
  accent: number;
  hair: number;
};

const PALETTES: Record<NpcVisualRole, Palette[]> = {
  resident: [
    { skin: 0xe8c4a8, shirt: 0x5a7a9a, pants: 0x3a3a48, accent: 0xc4a35a, hair: 0x3a2820 },
    { skin: 0xd4a888, shirt: 0x6a8a5a, pants: 0x4a4038, accent: 0x886644, hair: 0x5a3a20 },
    { skin: 0xc49878, shirt: 0x8a5a5a, pants: 0x2a2a30, accent: 0xaa8866, hair: 0x1a1210 },
  ],
  flyer: [
    { skin: 0xe0c0a8, shirt: 0x3a6a8a, pants: 0x2a3a48, accent: 0x44c8e8, hair: 0x4a3028 },
  ],
  vendor: [
    { skin: 0xe8c4a0, shirt: 0xc4a35a, pants: 0x4a4038, accent: 0x886622, hair: 0x5a4030 },
  ],
  girl: [
    { skin: 0xf0d0b8, shirt: 0xd47898, pants: 0x6a4058, accent: 0xffaacc, hair: 0x3a2018 },
    { skin: 0xe8c8b0, shirt: 0x88a0d0, pants: 0x4a4a68, accent: 0xffccdd, hair: 0x8a5030 },
    { skin: 0xf2d4bc, shirt: 0xe8a070, pants: 0x5a4850, accent: 0xffe0c0, hair: 0x2a1814 },
  ],
  robot_helper: [
    { skin: 0x8899aa, shirt: 0x6a7a88, pants: 0x4a5560, accent: 0xc4a35a, hair: 0x556677 },
  ],
  rogue: [
    { skin: 0xaa5555, shirt: 0x883333, pants: 0x442222, accent: 0xff6644, hair: 0x331111 },
  ],
  shopkeeper: [
    { skin: 0xe0b898, shirt: 0x5a6a7a, pants: 0x3a3840, accent: 0xc4a35a, hair: 0x4a3830 },
  ],
};

export type NpcMeshParts = {
  root: THREE.Group;
  body: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  board?: THREE.Object3D;
  medal?: THREE.Object3D;
};

function mat(color: number, opts?: { emissive?: number; metal?: number; rough?: number }) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.65,
    metalness: opts?.metal ?? 0.12,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissive ? 0.45 : 0,
  });
}

export function makeKitNpc(
  role: NpcVisualRole,
  _mats: Mats,
  opts?: { variant?: number; medallion?: boolean },
): NpcMeshParts {
  const g = new THREE.Group();
  g.name = `Npc_${role}`;
  const v = opts?.variant ?? 0;
  const pal = PALETTES[role][v % PALETTES[role].length]!;

  const skinM = mat(pal.skin, { rough: 0.75 });
  const shirtM = mat(pal.shirt, {
    metal: role === 'robot_helper' || role === 'rogue' ? 0.45 : 0.1,
    emissive: role === 'rogue' ? 0x440000 : role === 'flyer' ? 0x113344 : undefined,
  });
  const pantsM = mat(pal.pants);
  const accentM = mat(pal.accent, { metal: 0.3 });
  const hairM = mat(pal.hair, { rough: 0.9 });

  const hip = new THREE.Mesh(GEO.hip, pantsM);
  hip.position.y = 0.72;
  hip.castShadow = true;
  g.add(hip);

  const torso = new THREE.Mesh(GEO.torso, shirtM);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(GEO.head, skinM);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);

  // Face — simple expressive blocks
  const eyeWhite = mat(0xffffff);
  const pupil = mat(role === 'rogue' ? 0xff2222 : 0x222230, {
    emissive: role === 'rogue' ? 0xaa0000 : undefined,
  });
  for (const sx of [-1, 1]) {
    const ew = new THREE.Mesh(GEO.eye, eyeWhite);
    ew.position.set(sx * 0.1, 1.74, 0.22);
    g.add(ew);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.03), pupil);
    p.position.set(sx * 0.1, 1.74, 0.24);
    g.add(p);
  }
  const smile = new THREE.Mesh(
    GEO.smile,
    mat(role === 'girl' ? 0xd06080 : 0xb07060),
  );
  smile.position.set(0, 1.58, 0.22);
  g.add(smile);

  if (role === 'girl') {
    const hair = new THREE.Mesh(GEO.hair, hairM);
    hair.position.set(0, 1.92, -0.02);
    hair.scale.set(1.05, 0.9, 1.1);
    g.add(hair);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), hairM);
    sideL.position.set(-0.28, 1.55, 0);
    g.add(sideL);
    const sideR = sideL.clone();
    sideR.position.x = 0.28;
    g.add(sideR);
    const skirt = new THREE.Mesh(GEO.skirt, accentM);
    skirt.position.y = 0.78;
    g.add(skirt);
  } else if (role === 'vendor' || role === 'shopkeeper') {
    const brim = new THREE.Mesh(GEO.hatBrim, accentM);
    brim.position.y = 1.92;
    g.add(brim);
    const top = new THREE.Mesh(GEO.hatTop, accentM);
    top.position.y = 2.05;
    g.add(top);
  } else if (role === 'resident' && v % 2 === 0) {
    const brim = new THREE.Mesh(GEO.hatBrim, accentM);
    brim.position.y = 1.94;
    brim.scale.set(0.85, 1, 0.85);
    g.add(brim);
  } else {
    const hair = new THREE.Mesh(GEO.hair, hairM);
    hair.position.set(0, 1.9, -0.04);
    hair.scale.set(1, 0.55, 0.95);
    g.add(hair);
  }

  const legL = new THREE.Mesh(GEO.limb, pantsM);
  const legR = new THREE.Mesh(GEO.limb, pantsM);
  legL.position.set(-0.14, 0.38, 0);
  legR.position.set(0.14, 0.38, 0);
  legL.castShadow = true;
  legR.castShadow = true;
  g.add(legL, legR);

  const footL = new THREE.Mesh(GEO.foot, mat(0x2a2a30));
  const footR = footL.clone();
  footL.position.set(-0.14, 0.08, 0.04);
  footR.position.set(0.14, 0.08, 0.04);
  g.add(footL, footR);

  const armL = new THREE.Mesh(GEO.limb, shirtM);
  const armR = new THREE.Mesh(GEO.limb, shirtM);
  armL.position.set(-0.4, 1.15, 0);
  armR.position.set(0.4, 1.15, 0);
  g.add(armL, armR);
  const handL = new THREE.Mesh(GEO.hand, skinM);
  const handR = handL.clone();
  handL.position.set(-0.4, 0.85, 0);
  handR.position.set(0.4, 0.85, 0);
  g.add(handL, handR);

  let board: THREE.Object3D | undefined;
  if (role === 'flyer') {
    board = new THREE.Mesh(
      GEO.board,
      mat(0x3ad0f0, { emissive: 0x2288aa, metal: 0.45, rough: 0.35 }),
    );
    board.position.y = 0.14;
    board.scale.set(1, 1, 1.05);
    g.add(board);
    const fin = new THREE.Mesh(GEO.fin, mat(0xffffff, { emissive: 0x88ddff }));
    fin.position.set(0, 0.28, -0.38);
    g.add(fin);
  }

  let medal: THREE.Object3D | undefined;
  if (opts?.medallion) {
    medal = new THREE.Mesh(
      GEO.medal,
      mat(0xffd700, { emissive: 0xaa8800, metal: 0.85, rough: 0.25 }),
    );
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0.2, 1.25, 0.2);
    medal.name = 'eliasMedal';
    g.add(medal);
  }

  return { root: g, body: torso, legL, legR, armL, armR, board, medal };
}

export function tickNpcAnim(
  parts: NpcMeshParts,
  role: NpcVisualRole,
  t: number,
  moving: boolean,
  phase: number,
) {
  // Consistent walk cycle — cadence scales slightly by role
  const cadence = role === 'flyer' ? 11 : role === 'girl' ? 8.5 : 9.2;
  const walk = Math.sin(t * cadence + phase * 6);
  const idle = Math.sin(t * 1.7 + phase);
  const breath = Math.sin(t * 2.2 + phase * 3) * 0.012;

  if (moving) {
    const amp = role === 'flyer' ? 0.28 : 0.62;
    parts.legL.rotation.x = walk * amp;
    parts.legR.rotation.x = -walk * amp;
    parts.armL.rotation.x = -walk * amp * 0.9;
    parts.armR.rotation.x = walk * amp * 0.9;
    parts.body.position.y = 1.15 + Math.abs(walk) * 0.055 + breath;
    parts.root.position.y += 0; // keep caller-owned height
  } else {
    parts.legL.rotation.x = idle * 0.06;
    parts.legR.rotation.x = -idle * 0.05;
    parts.armL.rotation.x = idle * 0.08;
    parts.armR.rotation.x = -idle * 0.07;
    parts.body.position.y = 1.15 + breath;
  }

  if (parts.board) {
    parts.board.rotation.z = Math.sin(t * 2.8 + phase) * (moving ? 0.14 : 0.08);
    parts.board.rotation.x = moving ? -0.14 : Math.sin(t * 1.3 + phase) * 0.05;
    parts.board.position.y = 0.14 + (moving ? Math.abs(walk) * 0.02 : 0);
  }

  if (role === 'girl' && !moving) {
    parts.root.rotation.y += Math.sin(t * 1.1 + phase) * 0.002;
  }
  if (role === 'vendor' && !moving) {
    parts.armR.rotation.x = -0.35 + idle * 0.1;
  }
}
