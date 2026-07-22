/**
 * Shared site-builder session helpers (shop + factory + home).
 */

import type {
  FactoryForm,
  FactoryLayout,
  HomeLayout,
  HomeRoom,
  HomeRoomKind,
  HomeTier,
  SiteProp,
  StallLayout,
  StallTier,
  StorageTrack,
} from './economy';
import {
  quoteFactoryBuild,
  quoteHomeBuild,
  quoteStallBuild,
} from './economy';
import { defaultStallLayout } from './stallBuild';
import { defaultFactoryLayout } from './factoryBuild';
import { defaultHomeLayout } from './homeBuild';

export type SiteKind = 'stall' | 'factory' | 'bay_wing' | 'home';
export type SiteStep = 'site' | 'structure' | 'rooms' | 'props' | 'finalize';

export type SiteSession = {
  kind: SiteKind;
  districtId: string;
  storageTrack?: StorageTrack;
  redesign: boolean;
  applyUpgrade: boolean;
  baseCost: number;
  step: SiteStep;
  plotX: number;
  plotZ: number;
  yaw: number;
  sitePlaced: boolean;
  /** Shop */
  tier: StallTier;
  color: number;
  /** Factory */
  form: FactoryForm;
  /** Home */
  homeTier: HomeTier;
  rooms: HomeRoom[];
  /** Active room tool (home rooms step) */
  activeRoomKind: HomeRoomKind | null;
  props: SiteProp[];
  /** Active prop tool id (null = not placing) */
  activePropId: string | null;
  /** Local yaw for the item currently being aimed (prop / room wing) */
  placeYaw: number;
  /** Home-only: placing décor inside the shell (walls go translucent) */
  interiorDecor: boolean;
};

export function defaultSiteSession(opts: {
  kind: SiteKind;
  districtId: string;
  storageTrack?: StorageTrack;
  redesign: boolean;
  applyUpgrade: boolean;
  baseCost: number;
  stall?: StallLayout | null;
  factory?: FactoryLayout | null;
  home?: HomeLayout | null;
  plazaX: number;
  plazaZ: number;
}): SiteSession {
  const stall = opts.stall;
  const factory = opts.factory;
  const home = opts.home;
  const fromStall = opts.kind === 'stall' && stall?.built;
  const fromFactory = (opts.kind === 'factory' || opts.kind === 'bay_wing') && factory?.built;
  const fromHome = opts.kind === 'home' && home?.built;
  return {
    kind: opts.kind,
    districtId: opts.districtId,
    storageTrack: opts.storageTrack,
    redesign: opts.redesign,
    applyUpgrade: opts.applyUpgrade,
    baseCost: opts.baseCost,
    step: 'site',
    plotX: fromStall
      ? stall!.plotX
      : fromFactory
        ? factory!.plotX
        : fromHome
          ? home!.plotX
          : opts.plazaX,
    plotZ: fromStall
      ? stall!.plotZ
      : fromFactory
        ? factory!.plotZ
        : fromHome
          ? home!.plotZ
          : opts.plazaZ,
    yaw: fromStall
      ? stall!.yaw
      : fromFactory
        ? factory!.yaw
        : fromHome
          ? home!.yaw
          : 0,
    sitePlaced: !!(fromStall || fromFactory || fromHome),
    tier: stall?.tier ?? 'bench',
    color: fromHome ? (home?.color ?? 0) : (stall?.color ?? 0),
    form: factory?.form ?? 'horizontal',
    homeTier: home?.tier ?? 'cottage',
    rooms: fromHome
      ? (home!.rooms ?? []).map((r) => ({ ...r }))
      : [{ kind: 'living', lx: 0, lz: 0, yaw: 0 }],
    activeRoomKind: null,
    props: fromStall
      ? [...(stall!.props ?? [])]
      : fromFactory
        ? [...(factory!.props ?? [])]
        : fromHome
          ? [...(home!.props ?? [])]
          : [],
    activePropId: null,
    placeYaw: 0,
    interiorDecor: false,
  };
}

export function sessionStallLayout(s: SiteSession): StallLayout {
  const d = defaultStallLayout(s.plotX, s.plotZ);
  return {
    ...d,
    plotX: s.plotX,
    plotZ: s.plotZ,
    yaw: s.yaw,
    tier: s.tier,
    color: s.color,
    props: s.props.map((p) => ({ ...p })),
    built: false,
  };
}

export function sessionFactoryLayout(s: SiteSession): FactoryLayout {
  const d = defaultFactoryLayout(s.plotX, s.plotZ);
  return {
    ...d,
    plotX: s.plotX,
    plotZ: s.plotZ,
    yaw: s.yaw,
    form: s.form,
    props: s.props.map((p) => ({ ...p })),
    built: false,
  };
}

export function sessionHomeLayout(s: SiteSession): HomeLayout {
  const d = defaultHomeLayout(s.plotX, s.plotZ);
  return {
    ...d,
    plotX: s.plotX,
    plotZ: s.plotZ,
    yaw: s.yaw,
    tier: s.homeTier,
    color: s.color,
    props: s.props.map((p) => ({ ...p })),
    rooms: s.rooms.map((r) => ({ ...r })),
    built: false,
  };
}

/** Charge preview — only positive delta vs previous when redesigning */
export function siteChargePreview(
  s: SiteSession,
  prevStall: StallLayout | null | undefined,
  prevFactory: FactoryLayout | null | undefined,
  prevHome?: HomeLayout | null | undefined,
): number {
  if (s.kind === 'home') {
    const build = quoteHomeBuild({
      tier: s.homeTier,
      color: s.color,
      rooms: s.rooms,
      props: s.props,
    }).total;
    if (s.redesign && prevHome?.built) {
      const prev = quoteHomeBuild({
        tier: prevHome.tier,
        color: prevHome.color,
        rooms: prevHome.rooms,
        props: prevHome.props,
      }).total;
      return Math.max(0, build - prev);
    }
    return build;
  }
  if (s.kind === 'stall') {
    const build = quoteStallBuild({
      districtId: s.districtId,
      tier: s.tier,
      color: s.color,
      props: s.props,
      includeLease: false,
    }).total;
    if (s.redesign && prevStall?.built) {
      const prev = quoteStallBuild({
        districtId: s.districtId,
        tier: prevStall.tier,
        color: prevStall.color,
        props: prevStall.props,
        includeLease: false,
      }).total;
      return Math.max(0, build - prev);
    }
    return quoteStallBuild({
      districtId: s.districtId,
      tier: s.tier,
      color: s.color,
      props: s.props,
      includeLease: true,
    }).total;
  }
  const build = quoteFactoryBuild({ form: s.form, props: s.props, baseCost: 0 }).total;
  const prev = prevFactory?.built
    ? quoteFactoryBuild({
        form: prevFactory.form,
        props: prevFactory.props,
        baseCost: 0,
      }).total
    : 0;
  const delta = Math.max(0, build - prev);
  if (s.redesign || !s.applyUpgrade) return delta;
  return (s.baseCost ?? 0) + delta;
}

/** World XZ under camera for site / prop placement */
export function cameraFeetXZ(cam: { position: { x: number; z: number } }): {
  x: number;
  z: number;
} {
  return { x: cam.position.x, z: cam.position.z };
}

/** Ordered wizard steps for a site kind */
export function siteStepsFor(kind: SiteKind): SiteStep[] {
  if (kind === 'home') return ['site', 'structure', 'rooms', 'props', 'finalize'];
  return ['site', 'structure', 'props', 'finalize'];
}
