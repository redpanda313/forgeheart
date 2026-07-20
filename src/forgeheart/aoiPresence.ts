/**
 * Client-side Area-of-Interest (AOI) helpers for future ~32 CCU shards.
 * Ready for a presence server: subscribe/unsubscribe by radius without
 * requiring every client to render the whole world.
 */

export type AoiEntity = {
  id: string;
  x: number;
  z: number;
  /** 'local' | 'remote' | 'npc' | 'worker' */
  kind: string;
};

export type AoiSubscription = {
  entityId: string;
  detail: 'full' | 'lod' | 'blip';
};

/**
 * Given local player position and a set of entities, return who should be
 * fully detailed vs LOD vs map-blip only.
 */
export function computeAoiSubscriptions(
  playerX: number,
  playerZ: number,
  entities: AoiEntity[],
  opts?: { fullRadius?: number; lodRadius?: number; maxFull?: number },
): AoiSubscription[] {
  const fullR = opts?.fullRadius ?? 80;
  const lodR = opts?.lodRadius ?? 180;
  const maxFull = opts?.maxFull ?? 24;

  const scored = entities
    .map((e) => ({
      e,
      d: Math.hypot(e.x - playerX, e.z - playerZ),
    }))
    .sort((a, b) => a.d - b.d);

  const out: AoiSubscription[] = [];
  let fullCount = 0;
  for (const { e, d } of scored) {
    if (d <= fullR && fullCount < maxFull) {
      out.push({ entityId: e.id, detail: 'full' });
      fullCount++;
    } else if (d <= lodR) {
      out.push({ entityId: e.id, detail: 'lod' });
    } else {
      out.push({ entityId: e.id, detail: 'blip' });
    }
  }
  return out;
}

/** Shard sizing from SKY_EMPIRE_ECONOMY_DESIGN (~32 CCU). */
export const AOI_SHARD_TARGET_CCU = 32;
