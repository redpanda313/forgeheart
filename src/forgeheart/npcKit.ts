/**
 * Shared NPC visual kit — distinct silhouettes per role with cheap procedural anims.
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

const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.5, 4, 8);
const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
const hatGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8);
const coatGeo = new THREE.BoxGeometry(0.55, 0.55, 0.28);
const boardGeo = new THREE.BoxGeometry(0.38, 0.07, 1.05);
const skirtGeo = new THREE.ConeGeometry(0.32, 0.45, 8);
const medalGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10);

const PALETTE: Record<NpcVisualRole, { body: number; accent: number; emissive?: number }> = {
  resident: { body: 0xc4a882, accent: 0x6a5a48 },
  flyer: { body: 0x7a9aba, accent: 0x44c8e8, emissive: 0x226688 },
  vendor: { body: 0xd4b090, accent: 0xc4a35a },
  girl: { body: 0xe8c4b0, accent: 0xd47898 },
  robot_helper: { body: 0x8899aa, accent: 0xc4a35a },
  rogue: { body: 0xaa4444, accent: 0xff6644, emissive: 0x661100 },
  shopkeeper: { body: 0xb89878, accent: 0x5a7a9a },
};

export type NpcMeshParts = {
  root: THREE.Group;
  body: THREE.Object3D;
  board?: THREE.Object3D;
  medal?: THREE.Object3D;
};

export function makeKitNpc(
  role: NpcVisualRole,
  mats: Mats,
  opts?: { variant?: number; medallion?: boolean },
): NpcMeshParts {
  const g = new THREE.Group();
  g.name = `Npc_${role}`;
  const pal = PALETTE[role];
  const v = opts?.variant ?? 0;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: pal.body,
    roughness: 0.72,
    metalness: role.startsWith('robot') || role === 'rogue' ? 0.45 : 0.12,
    emissive: pal.emissive ?? 0x000000,
    emissiveIntensity: pal.emissive ? 0.45 : 0,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: pal.accent,
    roughness: 0.55,
    metalness: 0.25,
  });

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.88;
  body.scale.set(1 + (v % 3) * 0.04, 1 + (v % 2) * 0.06, 1);
  g.add(body);

  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.y = 1.42;
  g.add(head);

  if (role === 'girl') {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2820 + ((v * 0x101010) % 0x202020), roughness: 0.9 }),
    );
    hair.position.set(0, 1.52, -0.02);
    hair.scale.set(1.05, 0.85, 1.1);
    g.add(hair);
    const skirt = new THREE.Mesh(skirtGeo, accentMat);
    skirt.position.y = 0.55;
    g.add(skirt);
  } else if (role === 'vendor' || role === 'shopkeeper') {
    const apron = new THREE.Mesh(coatGeo, accentMat);
    apron.position.y = 0.95;
    apron.scale.set(0.9, 0.85, 0.7);
    g.add(apron);
    const hat = new THREE.Mesh(hatGeo, accentMat);
    hat.position.y = 1.58;
    g.add(hat);
  } else if (role === 'resident') {
    const coat = new THREE.Mesh(coatGeo, accentMat);
    coat.position.y = 1.0;
    coat.scale.set(0.85, 0.7, 0.65);
    g.add(coat);
    if (v % 2 === 0) {
      const hat = new THREE.Mesh(hatGeo, mats.brass);
      hat.position.y = 1.58;
      g.add(hat);
    }
  } else if (role === 'robot_helper' || role === 'rogue') {
    const cranial = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.26, 0.32),
      role === 'rogue' ? accentMat : mats.brass,
    );
    cranial.position.y = 1.48;
    g.add(cranial);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshStandardMaterial({
        color: role === 'rogue' ? 0xff4422 : 0x66ffaa,
        emissive: role === 'rogue' ? 0xff2200 : 0x22aa66,
        emissiveIntensity: 0.8,
      }),
    );
    eye.position.set(0.08, 1.5, 0.16);
    g.add(eye);
  }

  let board: THREE.Object3D | undefined;
  if (role === 'flyer') {
    board = new THREE.Mesh(
      boardGeo,
      new THREE.MeshStandardMaterial({
        color: 0x3ad0f0,
        emissive: 0x2288aa,
        emissiveIntensity: 0.5,
        metalness: 0.4,
        roughness: 0.35,
      }),
    );
    board.position.y = 0.12;
    // Reminiscent of player board — slight nose taper via scale asymmetry
    board.scale.set(1, 1, 1.08);
    g.add(board);
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ddff, emissiveIntensity: 0.35 }),
    );
    fin.position.set(0, 0.22, -0.35);
    g.add(fin);
  }

  let medal: THREE.Object3D | undefined;
  if (opts?.medallion) {
    medal = new THREE.Mesh(
      medalGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xaa8800,
        emissiveIntensity: 0.65,
        metalness: 0.8,
        roughness: 0.25,
      }),
    );
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0.22, 1.15, 0.18);
    medal.name = 'eliasMedal';
    g.add(medal);
  }

  return { root: g, body, board, medal };
}

/** Walk bob / board lean — call from animate with dt and speed factor. */
export function tickNpcAnim(
  parts: NpcMeshParts,
  role: NpcVisualRole,
  t: number,
  moving: boolean,
  phase: number,
) {
  const bob = moving ? Math.sin(t * 10 + phase * 6) * 0.04 : Math.sin(t * 2 + phase) * 0.01;
  parts.body.position.y = 0.88 + bob;
  if (parts.board) {
    parts.board.rotation.z = Math.sin(t * 3 + phase) * 0.12;
    parts.board.rotation.x = moving ? -0.08 : Math.sin(t * 1.5 + phase) * 0.05;
  }
  if (role === 'girl' && !moving) {
    parts.root.rotation.y += Math.sin(t * 1.2 + phase) * 0.002;
  }
}
