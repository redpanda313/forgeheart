/**
 * Visible bay workers — A* path around walls, run jobs / visual programs.
 */

import * as THREE from 'three';
import {
  type InventoryState,
  type JobId,
  type WorkerState,
  type ProgramNodeKind,
  JOB_DEFS,
  applyWorkerJobResult,
  applyProgramNodeResult,
  workerMoveSpeed,
  workerWorkMul,
  getWorkerProgramNodes,
  findVendorForTrade,
  PROGRAM_TRADE_ITEM,
  vendorWaypointKey,
} from './economy';
import type { NavGrid } from './navGrid';
import { makeKitNpc } from './npcKit';
import { makeMaterials } from './materials';
import { RobotUnit } from './robot';
import { paintFittedSign } from './signLabel';

export type HubWaypointKey = string;

const _workerMats = makeMaterials();

export type HubWaypoints = Record<string, THREE.Vector3>;

/** Destination key for a program / job step */
export function waypointForProgramNode(node: ProgramNodeKind): string {
  if (node === 'harvest') return 'reef';
  if (node === 'pick_flowers') return 'flowers';
  if (node === 'return_bay') return 'bay';
  if (node === 'repair') return 'repair';
  if (node === 'sell_frame') return 'broker';
  if (node.startsWith('craft_')) return 'craft';
  if (node.startsWith('stock_stall_') || node.startsWith('price_')) return 'stall';
  if (node === 'sell_invention' || node === 'sell_all_harvest') return 'market';
  if (node.startsWith('buy_5_')) {
    const id = PROGRAM_TRADE_ITEM[node];
    if (id) {
      const v = findVendorForTrade(id, 'buy');
      if (v) return vendorWaypointKey(v.id);
    }
    return 'market';
  }
  if (node.startsWith('sell_all_')) {
    const id = PROGRAM_TRADE_ITEM[node];
    if (id) {
      const v = findVendorForTrade(id, 'sell');
      if (v) return vendorWaypointKey(v.id);
    }
    return 'market';
  }
  const trade = PROGRAM_TRADE_ITEM[node];
  if (trade) {
    const v = findVendorForTrade(trade, node.startsWith('buy_') ? 'buy' : 'sell');
    if (v) return vendorWaypointKey(v.id);
    return 'market';
  }
  return 'bay';
}

export class WorkerAgent {
  readonly mesh: THREE.Group;
  readonly workerId: string;
  private path: THREE.Vector3[] = [];
  private pathIdx = 0;
  private workTimer = 0;
  private phase: 'walk' | 'work' | 'idle' = 'idle';
  /** Signature of current assignment so we rebuild when job/program changes */
  private assignSig = '';
  private pendingWork: ProgramNodeKind | JobId | null = null;
  private bob = 0;
  private boardMesh: THREE.Mesh | null = null;
  private toolMesh: THREE.Mesh | null = null;
  private label: THREE.Sprite;
  /** Program step index when running a visual program */
  private progStep = 0;
  /** Remaining legs after current path (built-in multi-stop jobs) */
  private legQueue: { key: HubWaypointKey; work?: JobId }[] = [];
  private stuckAcc = 0;
  private repathHint = 0;
  /** Tutorial-style chassis for robot workers */
  private robot: RobotUnit | null = null;

  constructor(worker: WorkerState, start: THREE.Vector3) {
    this.workerId = worker.id;
    this.mesh = new THREE.Group();
    this.mesh.name = `Worker_${worker.id}`;
    this.mesh.position.copy(start);
    this.mesh.position.y = 0;

    if (worker.kind === 'robot') {
      this.robot = new RobotUnit(_workerMats, new THREE.Vector3(0, 0, 0));
      this.robot.displayName = worker.name;
      this.robot.setPhase('ally');
      this.robot.mesh.position.set(0, 0, 0);
      this.mesh.add(this.robot.mesh);
      if (worker.hasMedallion) {
        const medal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10),
          new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xaa8800,
            emissiveIntensity: 0.55,
            metalness: 0.85,
            roughness: 0.25,
          }),
        );
        medal.rotation.x = Math.PI / 2;
        medal.position.set(0.22, 1.25, 0.22);
        medal.name = 'eliasMedal';
        this.robot.mesh.add(medal);
      }
    } else {
      const kit = makeKitNpc('resident', _workerMats, { variant: worker.name.length });
      this.mesh.add(kit.root);
    }

    this.boardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.08, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x44aacc,
        emissive: 0x226688,
        emissiveIntensity: 0.35,
        metalness: 0.4,
        roughness: 0.4,
      }),
    );
    this.boardMesh.position.set(0, 0.12, 0);
    this.boardMesh.visible = worker.hasBoard;
    this.mesh.add(this.boardMesh);

    this.toolMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.45, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, metalness: 0.6, roughness: 0.35 }),
    );
    this.toolMesh.position.set(0.38, 1.05, 0.1);
    this.toolMesh.visible = worker.hasSpeedTool;
    this.mesh.add(this.toolMesh);

    const labelName =
      worker.hasMedallion ? `${worker.name} ★` : worker.kind === 'robot' ? `${worker.name} ⚙` : worker.name;
    this.label = makeLabel(labelName);
    this.label.position.set(0, 2.15, 0);
    this.mesh.add(this.label);
  }

  syncLoadout(worker: WorkerState) {
    if (this.boardMesh) this.boardMesh.visible = worker.hasBoard;
    if (this.toolMesh) this.toolMesh.visible = worker.hasSpeedTool;
    this.refreshLabel(worker);
  }

  private refreshLabel(worker: WorkerState) {
    const canvas = (this.label.material as THREE.SpriteMaterial).map?.image as
      | HTMLCanvasElement
      | undefined;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let tag = jobShort(worker.job);
    if (worker.unpaid) tag = 'UNPAID';
    else if (worker.job === 'program') tag = 'PROG';
    else if (worker.job === 'idle' && (worker.id === 'bot_elias' || worker.hasMedallion)) tag = 'FOLLOW';
    const prefix = worker.hasMedallion ? '★ ' : worker.kind === 'robot' ? '⚙ ' : '';
    drawLabel(ctx, canvas.width, canvas.height, `${prefix}${worker.name} · ${tag}`);
    (this.label.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }

  /** Build navigated path for current worker assignment */
  repath(inv: InventoryState, waypoints: HubWaypoints, nav: NavGrid) {
    const w = inv.workers.find((x) => x.id === this.workerId);
    if (!w) return;
    this.assignSig = `${w.job}|${w.programId ?? ''}|${this.progStep}`;
    this.pendingWork = null;
    this.path = [];
    this.pathIdx = 0;
    this.workTimer = 0;
    this.legQueue = [];

    if (w.job === 'idle') {
      this.phase = 'idle';
      return;
    }

    if (w.job === 'program') {
      const nodes = getWorkerProgramNodes(inv, w);
      if (!nodes.length) {
        this.phase = 'idle';
        return;
      }
      const step = this.progStep % nodes.length;
      const node = nodes[step]!;
      const wpKey = waypointForProgramNode(node);
      const dest = waypoints[wpKey] ?? waypoints.market ?? waypoints.bay;
      this.path = nav.findPath(this.mesh.position, dest);
      this.pendingWork = node;
      this.phase = 'walk';
      this.pathIdx = 0;
      return;
    }

    // Built-in: queue legs; work only on action keys (not pure bay transit)
    const def = JOB_DEFS.find((j) => j.id === w.job);
    const keys = (def?.route ?? ['bay']) as HubWaypointKey[];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const isAction = i > 0 && i < keys.length - 1;
      this.legQueue.push({
        key,
        work: isAction ? w.job : undefined,
      });
    }
    this.startNextLeg(waypoints, nav);
  }

  private startNextLeg(waypoints: HubWaypoints, nav: NavGrid) {
    const leg = this.legQueue.shift();
    if (!leg) {
      // Loop job
      this.phase = 'idle';
      this.assignSig = ''; // force repath next tick
      return;
    }
    this.path = nav.findPath(this.mesh.position, waypoints[leg.key]);
    this.pathIdx = 0;
    this.pendingWork = leg.work ?? null;
    this.phase = 'walk';
  }

  tick(
    dt: number,
    inv: InventoryState,
    waypoints: HubWaypoints,
    nav: NavGrid,
    /** Player feet — idle soul-host robot follows until assigned a task */
    followTarget?: THREE.Vector3 | null,
  ): { msg?: string } | null {
    const w = inv.workers.find((x) => x.id === this.workerId);
    if (!w) {
      this.mesh.visible = false;
      return null;
    }
    this.mesh.visible = true;

    if (w.unpaid) {
      this.phase = 'idle';
      this.path = [];
      this.pendingWork = null;
      this.legQueue = [];
      const bay = waypoints.bay;
      if (bay) {
        const dx = bay.x - this.mesh.position.x;
        const dz = bay.z - this.mesh.position.z;
        if (Math.hypot(dx, dz) > 0.4) {
          const path = nav.findPath(this.mesh.position, bay);
          const target = path.length > 1 ? path[1]! : bay;
          const tdx = target.x - this.mesh.position.x;
          const tdz = target.z - this.mesh.position.z;
          const dist = Math.hypot(tdx, tdz) || 1;
          const speed = workerMoveSpeed(w) * 0.65;
          this.mesh.position.x += (tdx / dist) * Math.min(dist, speed * dt);
          this.mesh.position.z += (tdz / dist) * Math.min(dist, speed * dt);
        }
      }
      this.syncLoadout(w);
      return null;
    }

    const sig = `${w.job}|${w.programId ?? ''}|${this.progStep}`;
    if (!this.assignSig || this.assignSig !== sig) {
      const prev = this.assignSig.split('|');
      if (prev[0] !== w.job || prev[1] !== (w.programId ?? '')) this.progStep = 0;
      this.repath(inv, waypoints, nav);
      this.syncLoadout(w);
    }

    this.bob += dt * 30;
    const isIdleCompanion =
      w.job === 'idle' && (w.id === 'bot_elias' || !!w.hasMedallion) && !!followTarget;
    let moving = this.phase === 'walk';
    // Idle companion animates in its own branch (follow the player)
    if (!isIdleCompanion) {
      if (this.robot) {
        this.robot.tickAnim(dt, moving, 'ally');
      } else {
        const body = this.mesh.children[0];
        if (body) body.position.y = Math.sin(this.bob) * 0.04;
      }
    }

    // Finished a cycle with empty legs → restart job
    if (this.phase === 'idle' && w.job !== 'idle' && this.legQueue.length === 0 && !this.pendingWork) {
      this.assignSig = '';
      this.repath(inv, waypoints, nav);
    }

    if (w.job === 'idle') {
      if (isIdleCompanion && followTarget) {
        // Stay near the player until a Bay job/program is assigned
        const pos = this.mesh.position;
        const dx = followTarget.x - pos.x;
        const dz = followTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);
        moving = false;
        if (dist > 2.6) {
          const path = nav.findPath(pos, followTarget);
          const target = path.length > 1 ? path[1]! : followTarget;
          this.stepToward(target, workerMoveSpeed(w) * dt * 1.05, nav);
          moving = true;
        } else if (dist > 1.35) {
          this.stepToward(followTarget, workerMoveSpeed(w) * dt * 0.55, nav);
          moving = true;
        }
        // Face the engineer
        if (dist > 0.2) {
          this.mesh.rotation.y = Math.atan2(dx, dz);
        }
        if (this.robot) this.robot.tickAnim(dt, moving, 'ally');
        this.syncLoadout(w);
        return null;
      }
      const bay = waypoints.bay;
      if (!bay) return null;
      const path = nav.findPath(this.mesh.position, bay);
      const target = path.length > 1 ? path[1]! : bay;
      const bdx = bay.x - this.mesh.position.x;
      const bdz = bay.z - this.mesh.position.z;
      if (bdx * bdx + bdz * bdz > 0.6) {
        this.stepToward(target, workerMoveSpeed(w) * dt * 0.65, nav);
      }
      return null;
    }

    if (this.phase === 'walk') {
      const target = this.path[this.pathIdx];
      if (!target) {
        this.startNextLeg(waypoints, nav);
        return null;
      }
      const speed = workerMoveSpeed(w);
      const before = this.mesh.position.clone();
      const arrived = this.stepToward(target, speed * dt, nav);
      // Stuck recovery — repath if barely moved while walking
      if (!arrived) {
        const moved = this.mesh.position.distanceTo(before);
        if (moved < 0.02) this.stuckAcc += dt;
        else this.stuckAcc = Math.max(0, this.stuckAcc - dt);
        if (this.stuckAcc > 2.4) {
          this.stuckAcc = 0;
          this.repathHint++;
          const snap = nav.snapWalkable(this.mesh.position);
          this.mesh.position.x = snap.x;
          this.mesh.position.z = snap.z;
          this.assignSig = '';
          this.repath(inv, waypoints, nav);
          return {
            msg: `${w.name} found a new route (blocked path).`,
          };
        }
        return null;
      }
      this.stuckAcc = 0;

      this.pathIdx++;
      if (this.pathIdx < this.path.length) return null;

      // End of this leg
      if (this.pendingWork) {
        this.phase = 'work';
        this.workTimer =
          (this.pendingWork === 'harvest' || this.pendingWork === 'pick_flowers'
            ? 2.2
            : 1.5) * workerWorkMul(w);
      } else if (w.job === 'program') {
        // return_bay etc. with no economic effect
        this.progStep++;
        this.assignSig = '';
        this.repath(inv, waypoints, nav);
      } else {
        this.startNextLeg(waypoints, nav);
      }
      return null;
    }

    if (this.phase === 'work') {
      this.workTimer -= dt;
      if (this.workTimer > 0) return null;

      let result: { msg?: string } | null = null;
      if (w.job === 'program' && this.pendingWork) {
        const r = applyProgramNodeResult(
          inv,
          this.workerId,
          this.pendingWork as ProgramNodeKind,
        );
        if (r.msg) result = { msg: r.msg };
        this.progStep++;
        this.pendingWork = null;
        this.assignSig = '';
        this.repath(inv, waypoints, nav);
      } else if (this.pendingWork) {
        const r = applyWorkerJobResult(inv, this.workerId, this.pendingWork as JobId);
        if (r.msg) result = { msg: r.msg };
        this.pendingWork = null;
        this.startNextLeg(waypoints, nav);
      } else {
        this.startNextLeg(waypoints, nav);
      }
      return result;
    }

    return null;
  }

  private stepToward(target: THREE.Vector3, step: number, nav: NavGrid): boolean {
    const pos = this.mesh.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) {
      pos.x = target.x;
      pos.z = target.z;
      return true;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    let nextX = pos.x + nx * Math.min(step, dist);
    let nextZ = pos.z + nz * Math.min(step, dist);

    // If next cell blocked, slide along free axis or repath request via tiny offset
    if (!nav.lineClear(pos.x, pos.z, nextX, nextZ)) {
      // try axis-separated
      if (nav.lineClear(pos.x, pos.z, nextX, pos.z)) {
        nextZ = pos.z;
      } else if (nav.lineClear(pos.x, pos.z, pos.x, nextZ)) {
        nextX = pos.x;
      } else {
        // stuck — snap toward walkable
        const snap = nav.snapWalkable(pos);
        pos.x = snap.x;
        pos.z = snap.z;
        return false;
      }
    }

    pos.x = nextX;
    pos.z = nextZ;
    this.mesh.rotation.y = Math.atan2(nx, nz);
    return false;
  }
}

function jobShort(job: JobId): string {
  if (job === 'program') return 'PROG';
  return JOB_DEFS.find((j) => j.id === job)?.name ?? job;
}

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  paintFittedSign(ctx, w, h, text, {
    maxFont: 18,
    minFont: 10,
    fontFamily: 'system-ui,sans-serif',
    fill: 'rgba(12,18,28,0.8)',
    stroke: '#c4a35a',
    textColor: '#e8dcc0',
    pad: 8,
  });
}

function makeLabel(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  drawLabel(ctx, c.width, c.height, text);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(2.6, 0.52, 1);
  return s;
}

export function createWorkerAgents(
  inv: InventoryState,
  waypoints: HubWaypoints,
  parent: THREE.Object3D,
  nav: NavGrid,
): WorkerAgent[] {
  const agents: WorkerAgent[] = [];
  inv.workers.forEach((w, i) => {
    const start = waypoints.bay.clone();
    start.x += (i - 1) * 1.2;
    const a = new WorkerAgent(w, start);
    a.repath(inv, waypoints, nav);
    a.syncLoadout(w);
    parent.add(a.mesh);
    agents.push(a);
  });
  return agents;
}
