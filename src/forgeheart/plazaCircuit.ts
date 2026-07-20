/**
 * Theme-park board circuits on select plazas — local loop path + grind rails + jumps.
 */

import * as THREE from 'three';
import type { Collider } from './level';
import type { RaceRail } from './raceway';

export type PlazaCircuit = {
  districtId: string;
  path: THREE.Vector3[];
  pathDist: number[];
  rails: RaceRail[];
  group: THREE.Group;
  colliders: Collider[];
  start: THREE.Vector3;
};

function pathDistOf(path: THREE.Vector3[]): number[] {
  const d = [0];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    acc += path[i]!.distanceTo(path[i - 1]!);
    d.push(acc);
  }
  return d;
}

/** Oval + chicane circuit centered on plaza. */
export function buildPlazaCircuit(
  districtId: string,
  cx: number,
  cz: number,
  size: number,
): PlazaCircuit {
  const group = new THREE.Group();
  group.name = `Circuit_${districtId}`;
  const colliders: Collider[] = [];
  const rx = size * 0.38;
  const rz = size * 0.32;
  const path: THREE.Vector3[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    // Slight figure-8 wobble for interest
    const wobble = Math.sin(t * 2) * (size * 0.04);
    const x = cx + Math.cos(t) * rx + wobble;
    const z = cz + Math.sin(t) * rz;
    const y = 0.55 + Math.max(0, Math.sin(t * 2) * 1.8); // jumps on far sides
    path.push(new THREE.Vector3(x, y, z));
  }
  const dists = pathDistOf(path);

  // Airway ribbon (simple instanced-looking strip of planes)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < path.length - 1; i += 2) {
    const p0 = path[i]!;
    const p1 = path[i + 1]!;
    const mid = p0.clone().lerp(p1, 0.5);
    const len = p0.distanceTo(p1);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len * 0.95), mat);
    plane.geometry.rotateX(-Math.PI / 2);
    plane.position.copy(mid);
    const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    plane.rotation.y = yaw;
    plane.renderOrder = 2;
    group.add(plane);
    // Ride floor under jumps
    colliders.push({
      min: new THREE.Vector3(mid.x - 2.4, mid.y - 0.7, mid.z - 2.4),
      max: new THREE.Vector3(mid.x + 2.4, mid.y + 0.25, mid.z + 2.4),
      kind: 'skyway',
    });
  }

  // Grind rails along outer edge
  const rails: RaceRail[] = [];
  const railPts: THREE.Vector3[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    const prev = path[Math.max(0, i - 1)]!;
    const next = path[Math.min(path.length - 1, i + 1)]!;
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    railPts.push(new THREE.Vector3(p.x + nx * 2.6, p.y + 0.35, p.z + nz * 2.6));
  }
  rails.push({ points: railPts });
  // Visual rail tubes
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xc4a35a,
    metalness: 0.7,
    roughness: 0.35,
    emissive: 0x443311,
    emissiveIntensity: 0.25,
  });
  for (let i = 0; i < railPts.length - 1; i++) {
    const a = railPts[i]!;
    const b = railPts[i + 1]!;
    const mid = a.clone().lerp(b, 0.5);
    const h = a.distanceTo(b);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 5), railMat);
    tube.position.copy(mid);
    tube.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    group.add(tube);
  }

  // Start gate
  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xff8866, emissive: 0xaa4422, emissiveIntensity: 0.4 }),
  );
  gate.position.set(cx + rx, 1.2, cz);
  group.add(gate);
  const start = new THREE.Vector3(cx + rx * 0.85, 0.8, cz);

  return { districtId, path, pathDist: dists, rails, group, colliders, start };
}
