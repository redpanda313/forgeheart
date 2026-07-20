/**
 * Path / bridge / rail network mesher for Game Maker.
 * Connects nearby segments into smooth continuous ribbons and curved rails,
 * with branch junctions and riveted material transitions.
 * Does not join pieces that are too far apart.
 */

import * as THREE from 'three';
import type { Mats } from './materials';
import type { RaceRail } from './raceway';
import type { EditorCategory } from './editorCatalog';

/** Max endpoint distance / join tolerances (world units). */
export const CONNECT = {
  path: 3.1,
  walkway: 2.7,
  rail: 2.4,
  stair: 3.2,
  /** Mixed kinds (path↔walkway, path↔stair, …) */
  mixed: 2.9,
  /** Max |Δy| for flat deck end–end links */
  maxDy: 1.35,
  /** Max |Δy| when either end is a stair */
  maxDyStair: 4.5,
  /**
   * Rails may slope across one half-story layer (~1.75u) + slack.
   * See LAYER_HEIGHT in cityEditor.
   */
  maxDyRail: 2.35,
  /** Reject if endpoints face nearly the same way (parallel side-by-side false join) */
  minOpposeDot: -0.15,
  /**
   * T-junction: branch end may sit within this fraction of host half-width
   * beyond the edge (so end can rest on the deck surface).
   */
  midJoinHalfWidthFactor: 0.58,
  /** Extra world slack for mid-join distance to host centerline */
  midJoinSlack: 1.4,
  /** Ignore mid-join too close to host ends (those use end–end) */
  midJoinTMin: 0.07,
  midJoinTMax: 0.93,
} as const;

export type NetKind = 'path' | 'walkway' | 'rail' | 'stair';

export interface NetSegment {
  id: string;
  kind: NetKind;
  variant: number;
  /** World-space ends (along length) */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** Unit direction a → b */
  dir: THREE.Vector3;
  width: number;
  /** Deck / rail thickness */
  thick: number;
  /** Material key for transitions */
  matKey: string;
  color: number;
  metalness: number;
  roughness: number;
  /** Rail elevation offset from object origin already baked into a/b y */
  isRail: boolean;
}

export interface NetworkBuildResult {
  group: THREE.Group;
  /** Merged path centerlines for board path snap */
  pathPolylines: THREE.Vector3[][];
  /** Merged grind rails */
  rails: RaceRail[];
  connectionCount: number;
  junctionCount: number;
}

interface EndRef {
  segIdx: number;
  end: 0 | 1;
  pos: THREE.Vector3;
  /** Outward tangent (away from segment center) */
  outward: THREE.Vector3;
  kind: NetKind;
  matKey: string;
  width: number;
}

interface Junction {
  pos: THREE.Vector3;
  ends: EndRef[];
}

function matStyle(kind: NetKind, variant: number): {
  matKey: string;
  color: number;
  metalness: number;
  roughness: number;
  width: number;
  thick: number;
  len: number;
} {
  if (kind === 'path') {
    const lens = [10, 16, 24, 12, 10];
    return {
      matKey: variant === 4 ? 'path_pad' : 'path_stone',
      color: 0x5a5348,
      metalness: 0.2,
      roughness: 0.7,
      width: 10,
      thick: 0.35,
      len: lens[variant] ?? 10,
    };
  }
  if (kind === 'walkway') {
    const lens = [8, 16, 12, 14, 10];
    const wids = [3, 3, 3.5, 5, 3.2];
    return {
      matKey: variant === 2 ? 'walk_grate' : 'walk_brass',
      // Match path stone family when networked (no lime/leaf hues)
      color: variant === 2 ? 0x555860 : 0x6a5f4e,
      metalness: 0.35,
      roughness: 0.55,
      width: wids[variant] ?? 3,
      thick: 0.28,
      len: lens[variant] ?? 8,
    };
  }
  if (kind === 'rail') {
    const lens = [12, 20, 32, 8, 16];
    return {
      matKey: 'rail_glow',
      color: 0xe8f0ff,
      metalness: 0.9,
      roughness: 0.2,
      width: 0.45,
      thick: 0.22,
      len: lens[variant] ?? 12,
    };
  }
  // stair
  const steps = [5, 7, 9, 6, 4][variant] ?? 5;
  const stepD = 1.1;
  const wid = [6, 6, 5, 9, 7][variant] ?? 6;
  return {
    matKey: 'stair_stone',
    color: 0x8a7a5a,
    metalness: 0.35,
    roughness: 0.55,
    width: wid,
    thick: 0.3,
    len: steps * stepD,
  };
}

/** Extract a network segment from a placed object transform. */
export function segmentFromObject(
  id: string,
  category: EditorCategory,
  variant: number,
  position: THREE.Vector3,
  yaw: number,
  scale: THREE.Vector3,
): NetSegment | null {
  if (category !== 'path' && category !== 'walkway' && category !== 'rail' && category !== 'stair') {
    return null;
  }
  const kind = category as NetKind;
  const st = matStyle(kind, variant);
  const sx = scale.x;
  const sy = scale.y;
  const sz = scale.z;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const len = st.len * sz;
  const width = st.width * sx;

  if (kind === 'stair') {
    const steps = [5, 7, 9, 6, 4][variant] ?? 5;
    const stepH = ([0.35, 0.4, 0.55, 0.35, 0.5][variant] ?? 0.35) * sy;
    const stepD = 1.1 * sz;
    const totalLen = steps * stepD;
    const totalH = steps * stepH;
    // Stairs extend +Z local → forward; bottom at origin deck, top at far end
    const a = position.clone();
    a.y += 0.05;
    const b = position.clone().addScaledVector(forward, totalLen);
    b.y = position.y + totalH;
    const dir = b.clone().sub(a);
    if (dir.lengthSq() < 1e-6) dir.copy(forward);
    else dir.normalize();
    return {
      id,
      kind,
      variant,
      a,
      b,
      dir,
      width,
      thick: st.thick,
      matKey: st.matKey,
      color: st.color,
      metalness: st.metalness,
      roughness: st.roughness,
      isRail: false,
    };
  }

  if (kind === 'rail') {
    const elev = (variant === 4 ? 1.2 : 0.75) * sy;
    const a = position.clone().addScaledVector(forward, -len / 2);
    const b = position.clone().addScaledVector(forward, len / 2);
    a.y = position.y + elev;
    b.y = position.y + elev;
    return {
      id,
      kind,
      variant,
      a,
      b,
      dir: forward.clone(),
      width,
      thick: st.thick * sy,
      matKey: st.matKey,
      color: st.color,
      metalness: st.metalness,
      roughness: st.roughness,
      isRail: true,
    };
  }

  // path / walkway — flat deck at object y
  const a = position.clone().addScaledVector(forward, -len / 2);
  const b = position.clone().addScaledVector(forward, len / 2);
  a.y = position.y;
  b.y = position.y;
  return {
    id,
    kind,
    variant,
    a,
    b,
    dir: forward.clone(),
    width,
    thick: st.thick * Math.max(0.5, sy),
    matKey: st.matKey,
    color: st.color,
    metalness: st.metalness,
    roughness: st.roughness,
    isRail: false,
  };
}

function connectDist(ka: NetKind, kb: NetKind): number {
  if (ka === kb) {
    if (ka === 'path') return CONNECT.path;
    if (ka === 'walkway') return CONNECT.walkway;
    if (ka === 'rail') return CONNECT.rail;
    return CONNECT.stair;
  }
  return CONNECT.mixed;
}

/** Project point onto finite segment ab. t in [0,1], foot on segment, dist = horizontal-ish 3d. */
function projectOnSegment(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
): { foot: THREE.Vector3; t: number; dist: number } {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-8) {
    return { foot: a.clone(), t: 0, dist: p.distanceTo(a) };
  }
  let t = p.clone().sub(a).dot(ab) / lenSq;
  t = THREE.MathUtils.clamp(t, 0, 1);
  const foot = a.clone().addScaledVector(ab, t);
  return { foot, t, dist: p.distanceTo(foot) };
}

function canConnectEnds(ea: EndRef, eb: EndRef, segs: NetSegment[]): boolean {
  if (ea.segIdx === eb.segIdx) return false;
  const sa = segs[ea.segIdx]!;
  const sb = segs[eb.segIdx]!;
  // Rails only join rails (handled separately for linear + slope)
  if (sa.isRail || sb.isRail) return false;

  const dist = ea.pos.distanceTo(eb.pos);
  if (dist > connectDist(ea.kind, eb.kind)) return false;
  const dy = Math.abs(ea.pos.y - eb.pos.y);
  const stair = ea.kind === 'stair' || eb.kind === 'stair';
  if (dy > (stair ? CONNECT.maxDyStair : CONNECT.maxDy)) return false;
  const face = ea.outward.dot(eb.outward);
  // Parallel same-direction side-by-side (not facing) → skip unless almost touching
  if (face > 0.85 && dist > 0.85) return false;
  if (face > CONNECT.minOpposeDot && dist > connectDist(ea.kind, eb.kind) * 0.8 && dist > 1.35) {
    return false;
  }
  return true;
}

/** True if rails ends may join (linear only; slope ok across one layer). */
function canConnectRailEnds(ea: EndRef, eb: EndRef): boolean {
  if (ea.segIdx === eb.segIdx) return false;
  if (ea.kind !== 'rail' || eb.kind !== 'rail') return false;
  const dist = ea.pos.distanceTo(eb.pos);
  // Allow slightly longer horizontal span when sloping
  const dy = Math.abs(ea.pos.y - eb.pos.y);
  if (dy > CONNECT.maxDyRail) return false;
  const maxD = CONNECT.rail + (dy > 0.4 ? 0.6 : 0);
  if (dist > maxD) return false;
  // Prefer opposing ends; allow mild angles for slope ramps
  const face = ea.outward.dot(eb.outward);
  if (face > 0.75 && dist > 1.0) return false;
  return true;
}

interface MidJoin {
  branchSeg: number;
  branchEnd: 0 | 1;
  hostSeg: number;
  t: number;
  foot: THREE.Vector3;
  dist: number;
}

/**
 * T-junction / perpendicular branch: branch endpoint sits on (or near) host deck,
 * not only at host endpoints.
 */
function findMidJoins(segs: NetSegment[]): MidJoin[] {
  const candidates: MidJoin[] = [];
  for (let i = 0; i < segs.length; i++) {
    const branch = segs[i]!;
    if (branch.isRail) continue;
    for (const end of [0, 1] as const) {
      const ep = end === 0 ? branch.a : branch.b;
      for (let j = 0; j < segs.length; j++) {
        if (i === j) continue;
        const host = segs[j]!;
        if (host.isRail) continue;
        const { foot, t, dist } = projectOnSegment(ep, host.a, host.b);
        if (t < CONNECT.midJoinTMin || t > CONNECT.midJoinTMax) continue;
        // Reach the host deck: half-width + slack (paths are ~10u wide)
        const maxLateral = host.width * CONNECT.midJoinHalfWidthFactor + CONNECT.midJoinSlack;
        if (dist > maxLateral) continue;
        const dy = Math.abs(ep.y - foot.y);
        const stair = branch.kind === 'stair' || host.kind === 'stair';
        if (dy > (stair ? CONNECT.maxDyStair : CONNECT.maxDy + 0.4)) continue;
        // Prefer branches that aren't nearly collinear with host (side-by-side overlap)
        const hostDir = host.dir.clone();
        const branchDir = branch.dir.clone();
        const align = Math.abs(hostDir.dot(branchDir));
        // Collinear end-on mid is rare; if almost parallel and far from centerline edge, skip
        if (align > 0.92 && dist < host.width * 0.15) continue;
        candidates.push({
          branchSeg: i,
          branchEnd: end,
          hostSeg: j,
          t,
          foot: foot.clone(),
          dist,
        });
      }
    }
  }
  // One mid-join per branch end — closest host wins
  const best = new Map<string, MidJoin>();
  for (const c of candidates) {
    const key = `${c.branchSeg}:${c.branchEnd}`;
    const prev = best.get(key);
    if (!prev || c.dist < prev.dist) best.set(key, c);
  }
  // Also: if two branches claim nearly same foot, keep both (true multi-branch)
  return [...best.values()];
}

/** Union-find for endpoint clustering */
class UF {
  p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.p[i] !== i) {
      this.p[i] = this.p[this.p[i]!];
      i = this.p[i]!;
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[ra] = rb;
  }
}

function buildEndpoints(segs: NetSegment[]): EndRef[] {
  const ends: EndRef[] = [];
  segs.forEach((s, i) => {
    const outA = s.a.clone().sub(s.b);
    if (outA.lengthSq() < 1e-8) outA.set(0, 0, -1);
    else outA.normalize();
    const outB = s.b.clone().sub(s.a);
    if (outB.lengthSq() < 1e-8) outB.set(0, 0, 1);
    else outB.normalize();
    ends.push({
      segIdx: i,
      end: 0,
      pos: s.a.clone(),
      outward: outA,
      kind: s.kind,
      matKey: s.matKey,
      width: s.width,
    });
    ends.push({
      segIdx: i,
      end: 1,
      pos: s.b.clone(),
      outward: outB,
      kind: s.kind,
      matKey: s.matKey,
      width: s.width,
    });
  });
  return ends;
}

function clusterDeckEndpoints(
  ends: EndRef[],
  segs: NetSegment[],
): { junctions: Junction[]; endCluster: number[] } {
  const n = ends.length;
  const uf = new UF(n);
  for (let i = 0; i < n; i++) {
    if (segs[ends[i]!.segIdx]!.isRail) continue;
    for (let j = i + 1; j < n; j++) {
      if (segs[ends[j]!.segIdx]!.isRail) continue;
      if (canConnectEnds(ends[i]!, ends[j]!, segs)) uf.union(i, j);
    }
  }
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (segs[ends[i]!.segIdx]!.isRail) continue;
    const r = uf.find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(i);
  }
  const endCluster = new Array(n).fill(-1);
  const junctions: Junction[] = [];
  let ci = 0;
  for (const idxs of map.values()) {
    const clusterEnds = idxs.map((i) => ends[i]!);
    const pos = new THREE.Vector3();
    for (const e of clusterEnds) pos.add(e.pos);
    pos.multiplyScalar(1 / clusterEnds.length);
    junctions.push({ pos, ends: clusterEnds });
    for (const i of idxs) endCluster[i] = ci;
    ci++;
  }
  // Solo rail ends get no deck cluster
  for (let i = 0; i < n; i++) {
    if (endCluster[i] === -1) {
      endCluster[i] = ci;
      junctions.push({ pos: ends[i]!.pos.clone(), ends: [ends[i]!] });
      ci++;
    }
  }
  return { junctions, endCluster };
}

/**
 * Rails: greedy linear links only (each end ≤1 connection → no Y-branches).
 * Allows one-layer vertical slopes.
 */
function linkRailsLinear(
  ends: EndRef[],
  segs: NetSegment[],
): { pairs: { ea: number; eb: number; mid: THREE.Vector3 }[]; endSnap: Map<number, THREE.Vector3> } {
  type Cand = { i: number; j: number; dist: number };
  const cands: Cand[] = [];
  for (let i = 0; i < ends.length; i++) {
    if (ends[i]!.kind !== 'rail') continue;
    for (let j = i + 1; j < ends.length; j++) {
      if (ends[j]!.kind !== 'rail') continue;
      if (!canConnectRailEnds(ends[i]!, ends[j]!)) continue;
      cands.push({ i, j, dist: ends[i]!.pos.distanceTo(ends[j]!.pos) });
    }
  }
  cands.sort((a, b) => a.dist - b.dist);
  const usedEnd = new Set<number>(); // end index
  const pairs: { ea: number; eb: number; mid: THREE.Vector3 }[] = [];
  const endSnap = new Map<number, THREE.Vector3>();

  for (const c of cands) {
    if (usedEnd.has(c.i) || usedEnd.has(c.j)) continue;
    // Also: same segment's other end already linked is fine; only this end free
    usedEnd.add(c.i);
    usedEnd.add(c.j);
    const mid = ends[c.i]!.pos.clone().lerp(ends[c.j]!.pos, 0.5);
    // Smooth slope: mid y is average (already), add slight arch control later
    pairs.push({ ea: c.i, eb: c.j, mid });
    endSnap.set(c.i, mid.clone());
    endSnap.set(c.j, mid.clone());
  }
  void segs;
  return { pairs, endSnap };
}

function snappedEnd(
  segs: NetSegment[],
  endCluster: number[],
  junctions: Junction[],
  segIdx: number,
  end: 0 | 1,
  endOverride?: Map<string, THREE.Vector3>,
): THREE.Vector3 {
  const key = `${segIdx}:${end}`;
  if (endOverride?.has(key)) return endOverride.get(key)!.clone();
  const ei = segIdx * 2 + end;
  const j = junctions[endCluster[ei]!]!;
  if (j.ends.length === 1) return end === 0 ? segs[segIdx]!.a.clone() : segs[segIdx]!.b.clone();
  return j.pos.clone();
}

interface DeckChain {
  points: THREE.Vector3[];
  matKeys: string[];
  widths: number[];
  segsUsed: number[];
}

/**
 * Build deck ribbons including T-junctions (mid-joins) and end–end merges.
 */
function buildDeckChains(
  segs: NetSegment[],
  ends: EndRef[],
  endCluster: number[],
  junctions: Junction[],
  midJoins: MidJoin[],
): { chains: DeckChain[]; branchJunctions: THREE.Vector3[] } {
  // Overrides for branch ends that snap onto host
  const endOverride = new Map<string, THREE.Vector3>();
  // Host → list of split points along centerline
  const hostSplits = new Map<number, { t: number; pos: THREE.Vector3; branchKeys: string[] }[]>();
  const branchJunctions: THREE.Vector3[] = [];

  for (const mj of midJoins) {
    const key = `${mj.branchSeg}:${mj.branchEnd}`;
    endOverride.set(key, mj.foot.clone());
    branchJunctions.push(mj.foot.clone());
    if (!hostSplits.has(mj.hostSeg)) hostSplits.set(mj.hostSeg, []);
    hostSplits.get(mj.hostSeg)!.push({
      t: mj.t,
      pos: mj.foot.clone(),
      branchKeys: [key],
    });
  }
  // Merge nearby splits on same host
  for (const [host, list] of hostSplits) {
    list.sort((a, b) => a.t - b.t);
    const merged: typeof list = [];
    for (const s of list) {
      const last = merged[merged.length - 1];
      if (last && Math.abs(last.t - s.t) < 0.04) {
        last.pos.lerp(s.pos, 0.5);
        last.branchKeys.push(...s.branchKeys);
        for (const k of s.branchKeys) endOverride.set(k, last.pos.clone());
      } else {
        merged.push({ ...s, branchKeys: [...s.branchKeys] });
      }
    }
    hostSplits.set(host, merged);
  }

  // End–end adjacency for continuous runs (not mid-branch)
  const deckIdx = segs.map((s, i) => (!s.isRail ? i : -1)).filter((i) => i >= 0);
  const adj = new Map<number, { other: number; viaJ: number }[]>();
  for (const i of deckIdx) adj.set(i, []);

  junctions.forEach((j, ji) => {
    const deckEnds = j.ends.filter((e) => !segs[e.segIdx]!.isRail);
    if (deckEnds.length < 2) return;
    for (let a = 0; a < deckEnds.length; a++) {
      for (let b = a + 1; b < deckEnds.length; b++) {
        const ea = deckEnds[a]!;
        const eb = deckEnds[b]!;
        if (ea.segIdx === eb.segIdx) continue;
        // Skip if this end is already a mid-join onto some host (it's a branch stub)
        const keyA = `${ea.segIdx}:${ea.end}`;
        const keyB = `${eb.segIdx}:${eb.end}`;
        if (endOverride.has(keyA) || endOverride.has(keyB)) continue;
        adj.get(ea.segIdx)!.push({ other: eb.segIdx, viaJ: ji });
        adj.get(eb.segIdx)!.push({ other: ea.segIdx, viaJ: ji });
      }
    }
  });
  for (const [k, list] of adj) {
    const seen = new Set<number>();
    adj.set(
      k,
      list.filter((x) => {
        if (seen.has(x.other)) return false;
        seen.add(x.other);
        return true;
      }),
    );
  }

  /** Points along a single segment including mid-join feet */
  function segmentPoints(segIdx: number, fromA: boolean): {
    points: THREE.Vector3[];
    matKeys: string[];
    widths: number[];
  } {
    const s = segs[segIdx]!;
    let a = snappedEnd(segs, endCluster, junctions, segIdx, 0, endOverride);
    let b = snappedEnd(segs, endCluster, junctions, segIdx, 1, endOverride);
    // Mid-join overrides may replace one end with foot
    if (endOverride.has(`${segIdx}:0`)) a = endOverride.get(`${segIdx}:0`)!.clone();
    if (endOverride.has(`${segIdx}:1`)) b = endOverride.get(`${segIdx}:1`)!.clone();

    const splits = hostSplits.get(segIdx) ?? [];
    // Order points along a→b in geometric space
    type Node = { p: THREE.Vector3; t: number };
    const nodes: Node[] = [{ p: a, t: 0 }];
    for (const sp of splits) {
      nodes.push({ p: sp.pos.clone(), t: sp.t });
    }
    nodes.push({ p: b, t: 1 });
    nodes.sort((x, y) => x.t - y.t);
    if (!fromA) nodes.reverse();

    const points = nodes.map((n) => n.p);
    const matKeys = points.map(() => s.matKey);
    const widths = points.map(() => s.width);
    return { points, matKeys, widths };
  }

  const visitedSeg = new Set<number>();
  const chains: DeckChain[] = [];

  function deg(i: number) {
    return adj.get(i)?.length ?? 0;
  }

  /** Branch that only T-joins onto a host mid — drawn separately as a stub. */
  function isPureBranchStub(i: number): boolean {
    const midA = endOverride.has(`${i}:0`);
    const midB = endOverride.has(`${i}:1`);
    if (!midA && !midB) return false;
    // Pure stub if no end–end neighbors (or only mid-joined)
    return deg(i) === 0;
  }

  // --- Linear end–end chains (hosts that continue through) ---
  const starts = [
    ...deckIdx.filter((i) => deg(i) <= 1 && !isPureBranchStub(i)),
    ...deckIdx.filter((i) => deg(i) > 1),
  ];

  function walkLinear(startSeg: number, fromSeg: number) {
    if (visitedSeg.has(startSeg) && fromSeg >= 0) return;
    if (fromSeg < 0 && isPureBranchStub(startSeg)) return;
    const points: THREE.Vector3[] = [];
    const matKeys: string[] = [];
    const widths: number[] = [];
    const segsUsed: number[] = [];
    let cur = startSeg;
    let prev = fromSeg;
    let guard = 0;
    while (guard++ < 500) {
      if (visitedSeg.has(cur) && prev >= 0) break;
      visitedSeg.add(cur);
      segsUsed.push(cur);
      const s = segs[cur]!;
      let a = snappedEnd(segs, endCluster, junctions, cur, 0, endOverride);
      let b = snappedEnd(segs, endCluster, junctions, cur, 1, endOverride);
      if (endOverride.has(`${cur}:0`)) a = endOverride.get(`${cur}:0`)!.clone();
      if (endOverride.has(`${cur}:1`)) b = endOverride.get(`${cur}:1`)!.clone();

      // Insert host split points
      const splits = (hostSplits.get(cur) ?? []).slice().sort((x, y) => x.t - y.t);
      let ordered: THREE.Vector3[] = [a];
      // Map splits in a→b order using t
      for (const sp of splits) ordered.push(sp.pos.clone());
      ordered.push(b);

      if (prev >= 0 && points.length > 0) {
        const last = points[points.length - 1]!;
        if (last.distanceTo(ordered[ordered.length - 1]!) < last.distanceTo(ordered[0]!)) {
          ordered = ordered.reverse();
        }
      } else {
        const nbs = adj.get(cur) ?? [];
        if (nbs.length === 1) {
          const jpos = junctions[nbs[0]!.viaJ]!.pos;
          if (ordered[0]!.distanceTo(jpos) < ordered[ordered.length - 1]!.distanceTo(jpos)) {
            ordered = ordered.reverse();
          }
        }
      }

      if (points.length === 0) {
        for (let k = 0; k < ordered.length; k++) {
          points.push(ordered[k]!);
          matKeys.push(s.matKey);
          widths.push(s.width);
        }
      } else {
        // blend first
        points[points.length - 1] = ordered[0]!.clone().lerp(points[points.length - 1]!, 0.5);
        for (let k = 1; k < ordered.length; k++) {
          points.push(ordered[k]!);
          matKeys.push(s.matKey);
          widths.push(s.width);
        }
      }

      const nbs = (adj.get(cur) ?? []).filter((n) => n.other !== prev);
      if (nbs.length === 0) break;
      if (nbs.length === 1) {
        prev = cur;
        cur = nbs[0]!.other;
        continue;
      }
      for (const n of nbs) {
        if (!visitedSeg.has(n.other)) walkLinear(n.other, cur);
      }
      break;
    }
    if (points.length >= 2) chains.push({ points, matKeys, widths, segsUsed });
  }

  for (const start of starts) {
    if (visitedSeg.has(start)) continue;
    walkLinear(start, -1);
  }

  // Isolated hosts (no end–end adj) still need ribbon + splits
  for (const i of deckIdx) {
    if (visitedSeg.has(i)) continue;
    // If this is only a branch (mid-joined at one end) we'll add branch chain below
    const hasMid =
      endOverride.has(`${i}:0`) || endOverride.has(`${i}:1`) || hostSplits.has(i);
    if (hostSplits.has(i) || !endOverride.has(`${i}:0`) && !endOverride.has(`${i}:1`)) {
      const sp = segmentPoints(i, true);
      if (sp.points.length >= 2) {
        chains.push({
          points: sp.points,
          matKeys: sp.matKeys,
          widths: sp.widths,
          segsUsed: [i],
        });
        visitedSeg.add(i);
      }
    } else if (!hasMid) {
      const s = segs[i]!;
      chains.push({
        points: [s.a.clone(), s.b.clone()],
        matKeys: [s.matKey, s.matKey],
        widths: [s.width, s.width],
        segsUsed: [i],
      });
      visitedSeg.add(i);
    }
  }

  // --- Branch stubs: segment with a mid-join end → ribbon from free end to foot ---
  for (const mj of midJoins) {
    const i = mj.branchSeg;
    const s = segs[i]!;
    const freeEnd = mj.branchEnd === 0 ? 1 : 0;
    let free = freeEnd === 0 ? s.a.clone() : s.b.clone();
    // free end may also be end–end clustered
    free = snappedEnd(segs, endCluster, junctions, i, freeEnd as 0 | 1, endOverride);
    if (endOverride.has(`${i}:${freeEnd}`)) {
      // both ends mid-joined — use geometric free as other mid? skip
      free = freeEnd === 0 ? s.a.clone() : s.b.clone();
    }
    const foot = endOverride.get(`${i}:${mj.branchEnd}`) ?? mj.foot;
    // Mid control for smoother elbow into host
    const mid = free.clone().lerp(foot, 0.55);
    mid.add(s.dir.clone().multiplyScalar(0)); // keep
    // Pull mid slightly along branch direction for nicer curve
    const toward = foot.clone().sub(free);
    if (toward.lengthSq() > 1e-6) {
      const side = new THREE.Vector3().crossVectors(toward, new THREE.Vector3(0, 1, 0));
      if (side.lengthSq() > 1e-6) side.normalize().multiplyScalar(0);
    }
    chains.push({
      points: [free, free.clone().lerp(foot, 0.35), foot.clone()],
      matKeys: [s.matKey, s.matKey, s.matKey],
      widths: [s.width, s.width, s.width],
      segsUsed: [i],
    });
    visitedSeg.add(i);
  }

  void ends;
  return { chains, branchJunctions };
}

/**
 * Linear rail chains with sloping joins (no branches).
 */
function walkRailChainsLinear(
  segs: NetSegment[],
  ends: EndRef[],
  railLinks: ReturnType<typeof linkRailsLinear>,
): THREE.Vector3[][] {
  const railIdx = segs.map((s, i) => (s.isRail ? i : -1)).filter((i) => i >= 0);
  // Build adj between segments via accepted pairs only
  const adj = new Map<number, number[]>();
  for (const i of railIdx) adj.set(i, []);

  // Map end index → partner segment
  for (const p of railLinks.pairs) {
    const sa = ends[p.ea]!.segIdx;
    const sb = ends[p.eb]!.segIdx;
    adj.get(sa)!.push(sb);
    adj.get(sb)!.push(sa);
  }
  for (const [k, list] of adj) adj.set(k, [...new Set(list)]);

  const endPt = (segIdx: number, end: 0 | 1): THREE.Vector3 => {
    const ei = segIdx * 2 + end;
    if (railLinks.endSnap.has(ei)) return railLinks.endSnap.get(ei)!.clone();
    return end === 0 ? segs[segIdx]!.a.clone() : segs[segIdx]!.b.clone();
  };

  const visited = new Set<number>();
  const chains: THREE.Vector3[][] = [];

  function deg(i: number) {
    return adj.get(i)?.length ?? 0;
  }

  // Degree should be ≤2 always with linear linking
  const order = [...railIdx.filter((i) => deg(i) <= 1), ...railIdx.filter((i) => deg(i) === 2)];

  for (const start of order) {
    if (visited.has(start)) continue;
    const pts: THREE.Vector3[] = [];
    let cur = start;
    let prev = -1;
    let guard = 0;
    while (guard++ < 400) {
      if (visited.has(cur) && prev >= 0) break;
      visited.add(cur);
      let a = endPt(cur, 0);
      let b = endPt(cur, 1);
      if (pts.length > 0) {
        const last = pts[pts.length - 1]!;
        if (last.distanceTo(b) < last.distanceTo(a)) {
          const t = a;
          a = b;
          b = t;
        }
        // Slope blend: ease into join
        const blend = a.clone().lerp(last, 0.2);
        // Lift mid if height changes (smooth ramp)
        if (Math.abs(a.y - last.y) > 0.3) {
          const ramp = last.clone().lerp(a, 0.5);
          ramp.y = (last.y + a.y) * 0.5;
          pts.push(ramp);
        } else {
          pts.push(blend);
        }
      } else {
        pts.push(a);
      }
      // Interior sample for long rails
      if (a.distanceTo(b) > 4) {
        const mid = a.clone().lerp(b, 0.5);
        pts.push(mid);
      }
      pts.push(b);

      const nbs = (adj.get(cur) ?? []).filter((x) => x !== prev);
      if (nbs.length !== 1) break;
      prev = cur;
      cur = nbs[0]!;
    }
    if (pts.length >= 2) chains.push(pts);
  }

  for (const i of railIdx) {
    if (visited.has(i)) continue;
    chains.push([endPt(i, 0), endPt(i, 1)]);
    visited.add(i);
  }
  return chains;
}

function makeDeckMat(color: number, metalness: number, roughness: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    flatShading: false,
  });
  return m;
}

function tagOwned(mesh: THREE.Mesh) {
  mesh.userData.networkVisual = true;
  mesh.userData.networkOwnedMat = true;
}

/** Deck surface colors — keep connected ribbons on the path stone family (no foliage green). */
function colorForMatKey(key: string): { color: number; metalness: number; roughness: number } {
  switch (key) {
    case 'walk_brass':
      // Slightly warmer stone, not leafy green
      return { color: 0x6a5f4e, metalness: 0.35, roughness: 0.55 };
    case 'walk_grate':
      return { color: 0x555860, metalness: 0.55, roughness: 0.45 };
    case 'stair_stone':
      return { color: 0x63584a, metalness: 0.3, roughness: 0.6 };
    case 'path_pad':
      return { color: 0x58544c, metalness: 0.25, roughness: 0.65 };
    default:
      // path_stone — matches placed path prefab
      return { color: 0x5a5348, metalness: 0.2, roughness: 0.7 };
  }
}

/** Build a smooth ribbon along a polyline with varying width. */
function buildRibbon(
  points: THREE.Vector3[],
  widths: number[],
  matKeys: string[],
  thick: number,
  parent: THREE.Group,
  mats: Mats,
) {
  if (points.length < 2) return;

  // Catmull-Rom smooth sample
  const curvePts = points.map((p) => p.clone());
  // Ensure curve has enough points
  while (curvePts.length < 2) curvePts.push(curvePts[0]!.clone());
  const curve = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.35);
  const totalLen = Math.max(0.1, curve.getLength());
  const samples = Math.max(8, Math.ceil(totalLen / 0.55));
  const spaced = curve.getSpacedPoints(samples);

  // Interpolate width / mat along arc
  const widthsS: number[] = [];
  const matsS: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const fi = t * (points.length - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(points.length - 1, i0 + 1);
    const f = fi - i0;
    const w0 = widths[Math.min(i0, widths.length - 1)] ?? 8;
    const w1 = widths[Math.min(i1, widths.length - 1)] ?? w0;
    widthsS.push(THREE.MathUtils.lerp(w0, w1, f));
    matsS.push(matKeys[Math.min(i0, matKeys.length - 1)] ?? 'path_stone');
  }

  // Group samples by material runs for multi-material ribbons
  let runStart = 0;
  for (let i = 1; i <= samples + 1; i++) {
    const endRun = i > samples || matsS[i] !== matsS[runStart];
    if (!endRun) continue;
    const slice = spaced.slice(runStart, Math.min(i + 1, spaced.length)); // overlap 1 for continuity
    const wslice = widthsS.slice(runStart, Math.min(i + 1, widthsS.length));
    if (slice.length >= 2) {
      const style = colorForMatKey(matsS[runStart]!);
      addRibbonMesh(slice, wslice, thick, style, parent);
    }
    // Material transition collar between runs
    if (i <= samples && runStart > 0) {
      const p = spaced[runStart]!;
      const tan =
        runStart + 1 < spaced.length
          ? spaced[runStart + 1]!.clone().sub(spaced[runStart]!).normalize()
          : new THREE.Vector3(0, 0, 1);
      addMaterialTransition(p, tan, widthsS[runStart] ?? 8, matsS[runStart - 1]!, matsS[runStart]!, parent, mats);
    }
    // also at boundary when material changes at i
    if (i <= samples && matsS[i] !== matsS[runStart]) {
      const p = spaced[i]!;
      const tan =
        i + 1 < spaced.length
          ? spaced[i + 1]!.clone().sub(spaced[i]!).normalize()
          : spaced[i]!.clone().sub(spaced[i - 1]!).normalize();
      addMaterialTransition(p, tan, widthsS[i] ?? 8, matsS[runStart]!, matsS[i]!, parent, mats);
    }
    runStart = i;
  }

  // Center stripe
  addCenterLine(spaced, parent);
}

function addRibbonMesh(
  pts: THREE.Vector3[],
  widths: number[],
  thick: number,
  style: { color: number; metalness: number; roughness: number },
  parent: THREE.Group,
) {
  const n = pts.length;
  if (n < 2) return;
  // top surface + sides
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const lefts: THREE.Vector3[] = [];
  const rights: THREE.Vector3[] = [];
  const ups: THREE.Vector3[] = [];

  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(n - 1, i + 1)]!;
    const tan = next.clone().sub(prev);
    if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
    else tan.normalize();
    // up with slight path banking from tan.y
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(tan, up);
    if (right.lengthSq() < 1e-8) right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(1, 0, 0));
    right.normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, tan).normalize();
    const half = (widths[Math.min(i, widths.length - 1)] ?? 8) * 0.5;
    lefts.push(p.clone().addScaledVector(right, -half).addScaledVector(trueUp, thick));
    rights.push(p.clone().addScaledVector(right, half).addScaledVector(trueUp, thick));
    ups.push(trueUp);
  }

  // top
  for (let i = 0; i < n; i++) {
    positions.push(lefts[i]!.x, lefts[i]!.y, lefts[i]!.z);
    positions.push(rights[i]!.x, rights[i]!.y, rights[i]!.z);
    const u = ups[i]!;
    normals.push(u.x, u.y, u.z, u.x, u.y, u.z);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  // underside + sides for thickness
  const base = n * 2;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(n - 1, i + 1)]!;
    const tan = next.clone().sub(prev).normalize();
    let right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const half = (widths[Math.min(i, widths.length - 1)] ?? 8) * 0.5;
    const l = p.clone().addScaledVector(right, -half);
    const r = p.clone().addScaledVector(right, half);
    positions.push(l.x, l.y, l.z, r.x, r.y, r.z);
    normals.push(0, -1, 0, 0, -1, 0);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = base + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, makeDeckMat(style.color, style.metalness, style.roughness));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  tagOwned(mesh);
  parent.add(mesh);

  // Edge lips — dark stone curb matching path edges
  for (let side = -1; side <= 1; side += 2) {
    const edgePts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(n - 1, i + 1)]!;
      const tan = next.clone().sub(prev);
      if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
      else tan.normalize();
      let right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0));
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
      right.normalize();
      const half = (widths[Math.min(i, widths.length - 1)] ?? 8) * 0.5;
      edgePts.push(
        p
          .clone()
          .addScaledVector(right, side * half)
          .add(new THREE.Vector3(0, thick + 0.1, 0)),
      );
    }
    if (edgePts.length >= 2) {
      const ec = new THREE.CatmullRomCurve3(edgePts, false, 'catmullrom', 0.3);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(ec, Math.max(6, edgePts.length * 2), 0.055, 5, false),
        new THREE.MeshStandardMaterial({ color: 0x4a453c, metalness: 0.25, roughness: 0.7 }),
      );
      tube.castShadow = true;
      tagOwned(tube);
      parent.add(tube);
    }
  }
}

function addCenterLine(pts: THREE.Vector3[], parent: THREE.Group) {
  if (pts.length < 2) return;
  const elevated = pts.map((p) => p.clone().add(new THREE.Vector3(0, 0.38, 0)));
  const curve = new THREE.CatmullRomCurve3(elevated, false, 'catmullrom', 0.3);
  // Faded path stripe — same family as road, not neon
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(8, pts.length * 2), 0.045, 4, false),
    new THREE.MeshStandardMaterial({
      color: 0x8a8270,
      metalness: 0.15,
      roughness: 0.75,
      emissive: 0x000000,
      emissiveIntensity: 0,
    }),
  );
  tagOwned(mesh);
  parent.add(mesh);
}

/** Riveted brass collar at material transitions */
function addMaterialTransition(
  pos: THREE.Vector3,
  tan: THREE.Vector3,
  width: number,
  matA: string,
  matB: string,
  parent: THREE.Group,
  mats: Mats,
) {
  if (matA === matB) return;
  const t = tan.clone();
  if (t.lengthSq() < 1e-8) t.set(0, 0, 1);
  else t.normalize();
  const g = new THREE.Group();
  g.position.copy(pos);
  g.position.y += 0.2;
  // Orient so Z = tangent
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
  g.quaternion.copy(q);

  const half = width * 0.5 + 0.15;
  // Plate ring (box spanning width)
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, 0.12, 0.55),
    mats.brass,
  );
  plate.position.y = 0.08;
  g.add(plate);
  // Iron under-band
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.65, 0.08, 0.7),
    mats.iron,
  );
  band.position.y = 0.02;
  g.add(band);
  // Split colors hint — left/right chevrons
  const cA = colorForMatKey(matA).color;
  const cB = colorForMatKey(matB).color;
  const stripA = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.45, 0.04, 0.2),
    new THREE.MeshStandardMaterial({ color: cA, metalness: 0.4, roughness: 0.5 }),
  );
  stripA.position.set(-width * 0.2, 0.16, -0.1);
  tagOwned(stripA);
  g.add(stripA);
  const stripB = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.45, 0.04, 0.2),
    new THREE.MeshStandardMaterial({ color: cB, metalness: 0.4, roughness: 0.5 }),
  );
  stripB.position.set(width * 0.2, 0.16, 0.1);
  tagOwned(stripB);
  g.add(stripB);
  // Rivets along edges
  const rivetGeo = new THREE.SphereGeometry(0.07, 6, 6);
  for (let s = -1; s <= 1; s += 2) {
    for (let k = -2; k <= 2; k++) {
      const riv = new THREE.Mesh(rivetGeo, mats.copper);
      riv.position.set(s * half * 0.92, 0.18, k * 0.1);
      g.add(riv);
    }
  }
  // Corner bolts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), mats.ironDark);
      bolt.position.set(sx * half * 0.85, 0.16, sz * 0.22);
      g.add(bolt);
    }
  }
  g.userData.networkVisual = true;
  g.traverse((o) => {
    o.userData.networkVisual = true;
  });
  parent.add(g);
}

function addJunctionPlate(j: Junction, segs: NetSegment[], parent: THREE.Group, mats: Mats) {
  const deckEnds = j.ends.filter((e) => !segs[e.segIdx]!.isRail);
  if (deckEnds.length < 2) return;
  const maxW = Math.max(...deckEnds.map((e) => e.width), 6);
  const r = Math.max(2.2, maxW * 0.42);
  const isBranch = deckEnds.length >= 3;

  // Junction deck — path stone, not bright metal that can read as off-hue
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x5a5348,
    metalness: 0.22,
    roughness: 0.72,
  });
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.05, 0.32, isBranch ? 16 : 12),
    deckMat,
  );
  disk.position.copy(j.pos);
  disk.position.y += 0.12;
  disk.receiveShadow = true;
  disk.castShadow = true;
  tagOwned(disk);
  parent.add(disk);

  // Iron trim ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.92, 0.07, 6, 20),
    mats.iron,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(j.pos);
  ring.position.y += 0.3;
  ring.userData.networkVisual = true;
  parent.add(ring);

  // Brass rivets (small accents only)
  const nRiv = isBranch ? 10 : 6;
  for (let i = 0; i < nRiv; i++) {
    const ang = (i / nRiv) * Math.PI * 2;
    const riv = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mats.brassDark);
    riv.position.set(
      j.pos.x + Math.cos(ang) * r * 0.88,
      j.pos.y + 0.3,
      j.pos.z + Math.sin(ang) * r * 0.88,
    );
    riv.userData.networkVisual = true;
    parent.add(riv);
  }

  if (isBranch) {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.22, r * 0.22, 0.08, 10),
      mats.ironDark,
    );
    hub.position.copy(j.pos);
    hub.position.y += 0.28;
    hub.userData.networkVisual = true;
    parent.add(hub);
  }
}

function buildRailMesh(points: THREE.Vector3[], parent: THREE.Group) {
  if (points.length < 2) return;
  // Smooth curve through control points
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => p.clone()),
    false,
    'catmullrom',
    0.45,
  );
  const len = curve.getLength();
  const segs = Math.max(12, Math.ceil(len / 0.4));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segs, 0.2, 7, false),
    new THREE.MeshStandardMaterial({
      color: 0xe8f0ff,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xffcc33,
      emissiveIntensity: 0.4,
    }),
  );
  tube.castShadow = true;
  tagOwned(tube);
  parent.add(tube);

  // Glow strip on top — offset curve slightly up
  const topPts = curve.getSpacedPoints(segs).map((p) => p.clone().add(new THREE.Vector3(0, 0.16, 0)));
  const topCurve = new THREE.CatmullRomCurve3(topPts, false, 'catmullrom', 0.3);
  const strip = new THREE.Mesh(
    new THREE.TubeGeometry(topCurve, segs, 0.08, 5, false),
    new THREE.MeshStandardMaterial({
      color: 0xffee66,
      emissive: 0xffaa00,
      emissiveIntensity: 0.95,
      metalness: 0.5,
      roughness: 0.3,
    }),
  );
  tagOwned(strip);
  parent.add(strip);
}

function densifyPolyline(pts: THREE.Vector3[], spacing = 3): THREE.Vector3[] {
  if (pts.length < 2) return pts.map((p) => p.clone());
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone()), false, 'catmullrom', 0.4);
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / spacing));
  return curve.getSpacedPoints(n);
}

/**
 * Build full network visuals + export polylines from logical segments.
 */
export function buildPathNetwork(segments: NetSegment[], mats: Mats): NetworkBuildResult {
  const group = new THREE.Group();
  group.name = 'PathNetworkMesh';

  if (segments.length === 0) {
    return { group, pathPolylines: [], rails: [], connectionCount: 0, junctionCount: 0 };
  }

  const ends = buildEndpoints(segments);
  const midJoins = findMidJoins(segments);
  const { junctions, endCluster } = clusterDeckEndpoints(ends, segments);
  const railLinks = linkRailsLinear(ends, segments);

  let connectionCount = 0;
  let junctionCount = 0;

  // End–end deck junctions
  for (const j of junctions) {
    const deckEnds = j.ends.filter((e) => !segments[e.segIdx]!.isRail);
    if (deckEnds.length >= 2) {
      connectionCount += deckEnds.length - 1;
      junctionCount++;
      addJunctionPlate(j, segments, group, mats);
    }
  }

  // T-junction / branch plates
  const seenFeet = new Set<string>();
  for (const mj of midJoins) {
    const key = `${mj.foot.x.toFixed(1)},${mj.foot.z.toFixed(1)}`;
    if (seenFeet.has(key)) continue;
    seenFeet.add(key);
    connectionCount++;
    junctionCount++;
    const fakeJ: Junction = {
      pos: mj.foot.clone(),
      ends: [
        {
          segIdx: mj.branchSeg,
          end: mj.branchEnd,
          pos: mj.foot.clone(),
          outward: segments[mj.branchSeg]!.dir.clone(),
          kind: segments[mj.branchSeg]!.kind,
          matKey: segments[mj.branchSeg]!.matKey,
          width: segments[mj.branchSeg]!.width,
        },
        {
          segIdx: mj.hostSeg,
          end: 0,
          pos: mj.foot.clone(),
          outward: segments[mj.hostSeg]!.dir.clone(),
          kind: segments[mj.hostSeg]!.kind,
          matKey: segments[mj.hostSeg]!.matKey,
          width: segments[mj.hostSeg]!.width,
        },
      ],
    };
    addJunctionPlate(fakeJ, segments, group, mats);
  }

  connectionCount += railLinks.pairs.length;

  // Deck chains (path, walkway, stair) + branches
  const { chains: deckChains } = buildDeckChains(
    segments,
    ends,
    endCluster,
    junctions,
    midJoins,
  );
  const pathPolylines: THREE.Vector3[][] = [];
  for (const ch of deckChains) {
    if (ch.points.length < 2) continue;
    const thick = 0.32;
    buildRibbon(ch.points, ch.widths, ch.matKeys, thick, group, mats);
    pathPolylines.push(densifyPolyline(ch.points, 4));
  }

  // Rails — linear only, with slope blends
  const railChains = walkRailChainsLinear(segments, ends, railLinks);
  const rails: RaceRail[] = [];
  for (const ch of railChains) {
    buildRailMesh(ch, group);
    rails.push({ points: densifyPolyline(ch, 2.5) });
  }

  return { group, pathPolylines, rails, connectionCount, junctionCount };
}

/** Categories that participate in the network mesh */
export function isNetworkCategory(cat: EditorCategory): boolean {
  return cat === 'path' || cat === 'walkway' || cat === 'rail' || cat === 'stair';
}
