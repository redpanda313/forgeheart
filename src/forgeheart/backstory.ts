/**
 * Procedural engineer origin (Elias-class) — 6 axes × 6 values.
 */

const WHO = ['brother', 'sister', 'mentor', 'partner', 'child', 'crew'] as const;
const HOW = [
  'a demon-ridden frame',
  'a sky storm wreck',
  'a lab explosion',
  'a debt war',
  'a reef vanishing',
  'a willing husk transformation',
] as const;
const REMAINS = [
  'a talisman',
  'an incomplete chassis',
  'a last letter',
  'a voice cylinder',
  'a lock of brass-threaded hair',
  'a blank patent form',
] as const;
const WHY = [
  'to bring them back',
  'to prove the academy wrong',
  'to buy safety no storm can take',
  'to outdo a rival house',
  'to free every soul trapped in metal',
  'to get rich enough to never lose again',
] as const;
const MORAL = [
  'a gentle reprogrammer',
  'a ruthless scrapper',
  'a strict patent idealist',
  'a black-market salvager',
  'a city loyalist',
  'a free-market purist',
] as const;
const SCAR = [
  'heavy debt',
  'a famous family name',
  'a half-finished secret recipe',
  'an enemy house watching you',
  'one loyal friend in the market',
  'soft access to a closed dock',
] as const;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

export interface Backstory {
  seed: number;
  who: string;
  how: string;
  remains: string;
  why: string;
  moral: string;
  scar: string;
  /** Short prose for intro */
  summary: string;
  lines: string[];
}

export function generateBackstory(seed: number): Backstory {
  const rng = mulberry32(seed || 1);
  const who = pick(rng, WHO);
  const how = pick(rng, HOW);
  const remains = pick(rng, REMAINS);
  const why = pick(rng, WHY);
  const moral = pick(rng, MORAL);
  const scar = pick(rng, SCAR);

  const lines = [
    `You lost your ${who} to ${how}.`,
    `All that remains is ${remains}.`,
    `You build ${why}.`,
    `They call you ${moral} — and you carry ${scar}.`,
  ];

  return {
    seed,
    who,
    how,
    remains,
    why,
    moral,
    scar,
    summary: lines.join(' '),
    lines,
  };
}
