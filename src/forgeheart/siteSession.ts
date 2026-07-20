/**
 * Shared site-builder session helpers (shop + factory).
 */

import type {
  FactoryForm,
  FactoryLayout,
  SiteProp,
  StallLayout,
  StallTier,
  StorageTrack,
} from './economy';
import {
  quoteFactoryBuild,
  quoteStallBuild,
} from './economy';
import { defaultStallLayout } from './stallBuild';
import { defaultFactoryLayout } from './factoryBuild';

export type SiteKind = 'stall' | 'factory' | 'bay_wing';
export type SiteStep = 'site' | 'structure' | 'props' | 'finalize';

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
  props: SiteProp[];
  /** Active prop tool id (null = not placing) */
  activePropId: string | null;
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
  plazaX: number;
  plazaZ: number;
}): SiteSession {
  const stall = opts.stall;
  const factory = opts.factory;
  const fromStall = opts.kind === 'stall' && stall?.built;
  const fromFactory = opts.kind !== 'stall' && factory?.built;
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
        : opts.plazaX,
    plotZ: fromStall
      ? stall!.plotZ
      : fromFactory
        ? factory!.plotZ
        : opts.plazaZ,
    yaw: fromStall ? stall!.yaw : fromFactory ? factory!.yaw : 0,
    sitePlaced: !!(fromStall || fromFactory),
    tier: stall?.tier ?? 'bench',
    color: stall?.color ?? 0,
    form: factory?.form ?? 'horizontal',
    props: fromStall
      ? [...(stall!.props ?? [])]
      : fromFactory
        ? [...(factory!.props ?? [])]
        : [],
    activePropId: null,
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

/** Charge preview — only positive delta vs previous when redesigning */
export function siteChargePreview(
  s: SiteSession,
  prevStall: StallLayout | null | undefined,
  prevFactory: FactoryLayout | null | undefined,
): number {
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
