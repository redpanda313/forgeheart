/**
 * Procedural romance personas + player story-telling variants.
 * Same seeds → same text (save-stable). Axes × templates → thousands of combinations.
 */

import type { CommodityId } from './economy';

// ——— RNG ———

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

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const j = Math.floor(rng() * copy.length) % copy.length;
    out.push(copy.splice(j, 1)[0]!);
  }
  return out;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

// ——— Gift archetypes (stable per girl id — design identity) ———

export interface RomanceGiftArchetype {
  id: string;
  /** Display first name default; procedural surname may append */
  baseName: string;
  loves: readonly CommodityId[];
  dislikes: readonly CommodityId[];
  likesHint: string;
  dislikesHint: string;
}

export const ROMANCE_ARCHETYPES: Record<string, RomanceGiftArchetype> = {
  girl_lira: {
    id: 'girl_lira',
    baseName: 'Lira',
    loves: [
      'flower_gift',
      'bloom_sky',
      'bloom_brass',
      'bloom_spore',
      'bloom_harbor',
      'bloom_aether',
    ],
    dislikes: ['brass_charm', 'polished_wire'],
    likesHint: 'She loves flowers and bouquets — any plaza bloom or Cloud Blooms.',
    dislikesHint: 'Brass charms and polished wire feel cold to her.',
  },
  girl_mira: {
    id: 'girl_mira',
    baseName: 'Mira',
    loves: ['silk_scarf', 'bloom_spore'],
    dislikes: ['flower_gift', 'bloom_sky', 'bloom_brass'],
    likesHint: 'She wants a Spore-Silk Scarf (or rare Spore blooms).',
    dislikesHint: 'She scoffs at common Cloud Blooms and basic bouquets.',
  },
  girl_nova: {
    id: 'girl_nova',
    baseName: 'Nova',
    loves: ['brass_charm', 'polished_wire'],
    dislikes: ['silk_scarf', 'bloom_harbor', 'flower_gift'],
    likesHint: 'She loves Brass Charms and Polished Wire.',
    dislikesHint: 'Silk scarves and soft flower gifts feel frivolous to her.',
  },
  girl_sage: {
    id: 'girl_sage',
    baseName: 'Sage',
    loves: ['silk_scarf', 'bloom_aether', 'bloom_spore'],
    dislikes: ['brass_charm', 'polished_wire'],
    likesHint: 'She likes Spore-Silk Scarves, Aether blooms, and Spore blooms.',
    dislikesHint: 'Brass charms and polished wire feel impatient to her.',
  },
};

const SURNAMES = [
  'Voss', 'Quinn', 'Hale', 'Wren', 'Thrush', 'Ash', 'Cole', 'Reed', 'Vale', 'Keel',
  'Lantern', 'Moss', 'Pike', 'Yarrow', 'Underbay', 'Coil', 'Ember', 'Forge', 'Gilt', 'Hearth',
  'Quill', 'Riven', 'Sable', 'Tinker', 'Umbra', 'Vault', 'Weld', 'Yarn', 'Bolt', 'Cinder',
] as const;

const ORIGINS = [
  'the hanging gardens of Residential Ring',
  'a silk loft above Brass Arcade',
  'dockside rooms that never stop humming',
  'Cloud Academy’s quiet east wing',
  'a foundry family that counted bolts for lullabies',
  'spore terraces where the air tastes sweet',
  'a ferry that never quite chose a home port',
  'North Observatory’s windy steps',
  'a rented skyflat with one good window',
  'Grand Market’s back alleys after closing',
  'an aunt’s workshop that smelled of oil and tea',
  'the soft side of Industrial, if such a thing exists',
  'a boarding house full of apprentices',
  'St. Brass parish and its stubborn hope',
];

const VOCATIONS = [
  'tends plaza gardens for hire',
  'keeps ledgers for a silk trader',
  'tests board thrusters on quiet lanes',
  'repairs small automata nobody else has time for',
  'copies patent sketches for coin',
  'walks night deliveries between plazas',
  'teaches children which blooms are safe to touch',
  'runs a tiny stall two days a week',
  'sings at dock openings when the brass is good',
  'maps wind paths for nervous first-time riders',
  'sorts reef salvage into honest piles',
  'writes letters for people who hate ink',
];

const TEMPERAMENTS = [
  'quick to laugh, slower to trust',
  'soft-spoken until a principle is crossed',
  'playful in public, serious in private',
  'blunt as a stamped gear',
  'curious to the point of trouble',
  'patient with machines, impatient with bragging',
  'warm, then suddenly distant if rushed',
  'dry-humored and hard to impress',
  'earnest in a way that startles busy people',
  'wary of empire boys with too-clean boots',
  'gentle, with a spine of drawn wire',
  'competitive about the small things that matter',
];

const SOFT_SPOTS = [
  'stray cats on the skyways',
  'honest apologies',
  'people who remember names',
  'hand-mended clothes',
  'late-night tea gone cold',
  'boards that still have scratches from learning',
  'kids who ask how gears work',
  'makers who admit when a design failed',
  'quiet plazas after rain-fog',
  'stories that don’t end in a sale',
];

const FEARS = [
  'being treated like scenery',
  'another winter alone in a loud city',
  'gifts that are really transactions',
  'rushing into the wrong forever',
  'losing the small freedoms she fought for',
  'pretty words with empty hands',
  'becoming someone’s soft escape from responsibility',
];

const DREAMS = [
  'a garden that doesn’t rent by the week',
  'a shop of her own with honest hours',
  'someone who stays after the patent season ends',
  'enough brass to choose slow days',
  'to see the outer reefs once without working them',
  'a home loft with two chairs that get used',
  'to be known for more than a pretty stall smile',
];

const SPEECH = [
  'half-joking',
  'careful',
  'direct',
  'lyrical',
  'teasing',
  'quiet',
  'bright',
  'measured',
] as const;

// ——— Generated persona ———

export interface GeneratedRomancePersona {
  id: string;
  name: string;
  loves: readonly CommodityId[];
  dislikes: readonly CommodityId[];
  likesHint: string;
  dislikesHint: string;
  origin: string;
  vocation: string;
  temperament: string;
  softSpot: string;
  fear: string;
  dream: string;
  speech: (typeof SPEECH)[number];
  chatByStage: [string, string, string, string, string];
  aboutLines: string[];
  storyReactions: string[];
  /** One-line bio for UI subheader */
  bioLine: string;
  seed: number;
}

export function romancePersonaSeed(npcId: string, worldSeed: number): number {
  return hashStr(`romance:${npcId}:${worldSeed >>> 0}`);
}

export function generateRomancePersona(npcId: string, worldSeed: number): GeneratedRomancePersona {
  const arch = ROMANCE_ARCHETYPES[npcId];
  const seed = romancePersonaSeed(npcId, worldSeed || 1);
  const rng = mulberry32(seed);
  // burn
  rng();
  rng();

  const surname = pick(rng, SURNAMES);
  const baseName = arch?.baseName ?? capitalize(npcId.replace(/^girl_/, ''));
  const name = `${baseName} ${surname}`;
  const origin = pick(rng, ORIGINS);
  const vocation = pick(rng, VOCATIONS);
  const temperament = pick(rng, TEMPERAMENTS);
  const softSpot = pick(rng, SOFT_SPOTS);
  const fear = pick(rng, FEARS);
  const dream = pick(rng, DREAMS);
  const speech = pick(rng, SPEECH);

  const loves = arch?.loves ?? (['flower_gift'] as const);
  const dislikes = arch?.dislikes ?? (['brass_charm'] as const);
  const likesHint = arch?.likesHint ?? 'She has particular tastes.';
  const dislikesHint = arch?.dislikesHint ?? 'Some gifts land wrong.';

  const chat0 = pick(rng, [
    `Oh— a maker from ${origin.includes('dock') ? 'the docks' : 'somewhere interesting'}? Careful.`,
    `You look like you ${vocation.split(' ')[0] === 'tests' ? 'ride hard' : 'work hard'}. Do you also stop?`,
    `Most people rush past. You paused. That’s already unusual.`,
    `If you’re here to sell me something, leave. If you’re here to talk… maybe stay.`,
    `I grew up around ${origin}. This plaza is quieter. I like that.`,
  ]);
  const chat1 = pick(rng, [
    `You again. I’m ${temperament} — don’t take the first silence personally.`,
    `Still showing up. That’s either stubborn or sweet.`,
    `I ${vocation}. When you visit, try not to treat me like a waypoint.`,
    `Tell me something true, not something impressive.`,
    `I’m ${speech} when I care. You’ll notice the difference.`,
  ]);
  const chat2 = pick(rng, [
    `I’ve decided you’re not pure noise. Soft spot confession: ${softSpot}.`,
    `Friendly looks good on you. Don’t waste it on empty brass talk.`,
    `I still ${vocation}, but I save better hours for people who listen.`,
    `The city can wait. Sit. Tell me a non-ledger story.`,
    `You’re learning my pace. That’s rarer than a clean patent.`,
  ]);
  const chat3 = pick(rng, [
    `Close enough that I might admit what I’m afraid of: ${fear}.`,
    `I trust you with quieter rooms now.`,
    `If you bring a gift, make it honest. I can smell a transaction.`,
    `Walk with me after dusk. I want company that doesn’t rush.`,
    `You’re in the circle of people I actually answer.`,
  ]);
  const chat4 = pick(rng, [
    `Stay. My dream is simple — ${dream} — and you keep not laughing at it.`,
    `Sweetheart is a heavy word. You’re carrying it well.`,
    `I don’t need a speech. Just be here when the wind gets mean.`,
    `You’ve seen the soft parts. Don’t armor up now.`,
    `The city can have your days. I’d like some of your evenings.`,
  ]);

  const aboutLines = [
    pick(rng, [
      `I come from ${origin}. That never fully leaves a person.`,
      `Home was ${origin}. I still measure comfort by whether the air feels familiar.`,
      `People ask where I’m from. ${capitalize(origin)} — and then they change the subject.`,
    ]),
    pick(rng, [
      `By day I ${vocation}. It pays enough to choose who I smile at.`,
      `Work: I ${vocation}. It’s not glamorous. It’s mine.`,
      `If you need me when I’m busy, look for the woman who ${vocation}.`,
    ]),
    pick(rng, [
      `I’m ${temperament}. Gifts that ignore that bounce off.`,
      `Soft spot? ${capitalize(softSpot)}. Don’t weaponize it.`,
      `I’m scared of ${fear}. If you push there, I’ll vanish.`,
    ]),
    pick(rng, [
      `What I want long-term is ${dream}. Pretty talk without that bores me.`,
      `Likes: ${likesHint}`,
      `And for the record — ${dislikesHint}`,
    ]),
  ];

  const storyReactions = pickN(
    rng,
    [
      'That… actually explains the way you look at machines.',
      'You’re building a life, not just a ledger. I like that.',
      'Keep talking. I want the honest version.',
      'Hmm. Ambition looks better when it has a pulse.',
      'So the empire isn’t just noise — you have a spine under it.',
      'That’s a builder’s story. I can work with that.',
      'Thank you for not rushing the truth.',
      'Your lost one… I won’t make you say more than you want.',
      'That invention of yours — I can hear how proud you are.',
      'You talk about your crew like family. That’s rare.',
      'I believe you. Don’t make me regret it.',
      'There’s grief in that, and grit. Both fit you.',
      'Say more when you’re ready. I’ll still be here.',
      'You’re not performing. Good.',
      'That was real. I felt it.',
      'I like the version of you that admits the hard numbers and the soft reasons.',
    ],
    5,
  ) as string[];

  return {
    id: npcId,
    name,
    loves,
    dislikes,
    likesHint,
    dislikesHint,
    origin,
    vocation,
    temperament,
    softSpot,
    fear,
    dream,
    speech,
    chatByStage: [chat0, chat1, chat2, chat3, chat4],
    aboutLines,
    storyReactions,
    bioLine: `${temperament}. From ${origin}.`,
    seed,
  };
}

// ——— Player story presentation (narrative, not lists) ———

export interface PlayerStoryContext {
  companionName: string;
  whoOf: string;
  how: string;
  why: string;
  remains: string;
  moral: string;
  /** Optional live empire facts */
  workerNames: string[];
  workerCount: number;
  unpaidCount: number;
  topInvention?: { name: string; quality: number; sellValue: number };
  inventionCount: number;
  brass: number;
  matTotal: number;
  blooms: number;
  harvestRuns: number;
  bayLevel: number;
  cityWorkshop: boolean;
  apartment: boolean;
  stalls: number;
  peakBrass: number;
}

export type RomanceStoryId =
  | 'origin'
  | 'companion'
  | 'crew'
  | 'invention'
  | 'resources'
  | 'workshop';

/** Stable seed for one telling of a beat to one person. */
export function storyTellSeed(
  worldSeed: number,
  npcId: string,
  storyId: string,
  salt = 0,
): number {
  return hashStr(`tell:${worldSeed}:${npcId}:${storyId}:${salt}`);
}

export function formatPlayerStoryBeat(
  storyId: RomanceStoryId,
  ctx: PlayerStoryContext,
  seed: number,
): string {
  const rng = mulberry32(seed || 1);
  rng();

  switch (storyId) {
    case 'origin':
      return pick(rng, [
        `I don’t open this lightly. I lost ${ctx.whoOf} to ${ctx.how}. What remains is ${ctx.remains} — and the stubborn habit of building ${ctx.why}.`,
        `People ask why I work like this. Because ${ctx.whoOf} was taken by ${ctx.how}. I still keep ${ctx.remains} where I can see it.`,
        `My start wasn’t a market plan. It was grief with tools. ${capitalize(ctx.whoOf)} — ${ctx.how}. ${capitalize(ctx.remains)} sits on the bench like a dare.`,
        `I’ll say it plain: ${ctx.how} took ${ctx.whoOf}. I became the kind of engineer who builds ${ctx.why}, and I don’t apologize for the soft parts.`,
        `There’s a hole shaped like ${ctx.whoOf}. ${capitalize(ctx.how)} put it there. I fill days with brass and the hope that love can seat in metal.`,
        `If you want the real origin: not a patent, a person. ${capitalize(ctx.whoOf)}. ${capitalize(ctx.how)}. ${capitalize(ctx.remains)} is the only heirloom that matters.`,
      ]);

    case 'companion':
      return pick(rng, [
        `${ctx.companionName} isn’t a tool to me. After I woke ${ctx.whoOf.includes('brother') || ctx.whoOf.includes('sister') || ctx.whoOf.includes('child') ? 'them' : 'them'} in brass, the city felt less empty. I still build ${ctx.why}.`,
        `You asked about the frame with green eyes. That’s ${ctx.companionName} — soul and scrap, walking. I speak their name in the plasma when the docks get loud.`,
        `${ctx.companionName} follows when the work allows. They’re proof that ${ctx.remains} wasn’t just scrap. They keep me honest about ${ctx.why}.`,
        `Some makers brag about frames sold. I brag that ${ctx.companionName} still chooses to stand beside me.`,
        `I don’t call ${ctx.companionName} inventory. They’re the chapter after loss — noisy, loyal, and slightly terrifying when the eyes go wrong.`,
      ]);

    case 'crew': {
      const n = ctx.workerCount;
      const names = ctx.workerNames;
      if (n === 0) {
        return pick(rng, [
          `Crew? Just me and the echo in the bay. I hire when the brass stops shaking.`,
          `I work alone right now. It’s quieter. Also lonelier. I’m not romanticizing it.`,
          `No payroll yet — only stubborn hands and a workshop that judges me.`,
        ]);
      }
      if (n === 1) {
        const w = names[0] ?? 'my only hire';
        return pick(rng, [
          `I’ve got one person on the books: ${w}. We argue about routes and share tea like a tiny empire.`,
          `${w} is the whole crew. If they quit, the bay goes silent. I try not to think about that.`,
          `Just ${w} and me. They pretend not to notice when I talk to frames like people.`,
        ]);
      }
      const sample = names.slice(0, 3).join(', ');
      const extra = n > 3 ? ` and ${n - 3} more` : '';
      const unpaid =
        ctx.unpaidCount > 0
          ? pick(rng, [
              ` ${ctx.unpaidCount} are waiting on wages — my fault on lean weeks.`,
              ` I’ve shorted ${ctx.unpaidCount} when the ledger pinched; I’m fixing that.`,
            ])
          : '';
      return pick(rng, [
        `My crew is ${n} strong — ${sample}${extra}. They’re not scenery; they know the reef routes better than I admit.${unpaid}`,
        `I’ve hired ${n}: ${sample}${extra}. Half of them tease me for talking to robots. The other half do it too.${unpaid}`,
        `${n} people draw pay from my brass. Names worth knowing: ${sample}${extra}. Without them I’m just a man with good intentions and empty stalls.${unpaid}`,
        `Fun truth: ${sample}${extra} once raced who could stock a stall faster. I lost a day of dignity and gained a family of sorts. Crew size: ${n}.${unpaid}`,
      ]);
    }

    case 'invention': {
      const inv = ctx.topInvention;
      if (!inv) {
        return pick(rng, [
          `I haven’t invented anything I’m proud of yet — only copies and repairs. That stings more than I say out loud.`,
          `The invent desk is still waiting for me. Or I’m waiting for courage. Same difference.`,
        ]);
      }
      return pick(rng, [
        `My proudest make is ${inv.name} — quality ${inv.quality}, sells near ${inv.sellValue} brass. I still remember the night the prototype stopped smoking.`,
        `If I’m allowed one boast: ${inv.name}. Not because of the price tag (~${inv.sellValue}b), but because it worked when the academy said it wouldn’t.`,
        `${inv.name} is the one I show off when I’m not careful. Q${inv.quality}. I built it hungry and slightly desperate.`,
        `I’ve got ${ctx.inventionCount} invention${ctx.inventionCount === 1 ? '' : 's'} in the book. The one that still makes me grin is ${inv.name}.`,
        `${inv.name} pays well, sure — but the real prize was watching a stall customer argue over the last unit.`,
      ]);
    }

    case 'resources': {
      const rich = ctx.brass >= 800 || ctx.matTotal >= 40;
      const poor = ctx.brass < 80 && ctx.matTotal < 8;
      if (poor) {
        return pick(rng, [
          `Ledger honesty: ${ctx.brass} brass and thin stock. I’ve run ${ctx.harvestRuns} hauls and still count bolts like prayers.`,
          `I’m not flush. ${ctx.brass} brass, a few mats, ${ctx.blooms} blooms if I’m lucky. The reef and I are still negotiating.`,
          `Resources are a love language I speak poorly right now — light brass, light shelves. But I’m still here.`,
        ]);
      }
      if (rich) {
        return pick(rng, [
          `I’ve stacked enough that fear got quieter: ${ctx.brass} brass, shelves heavy with ${ctx.matTotal} raw units, ${ctx.blooms} blooms for personality work. Peak held: ${ctx.peakBrass}.`,
          `Don’t let the number impress you too much — but ${ctx.brass} brass means my crew eats. ${ctx.harvestRuns} hauls taught me which reefs lie.`,
          `Funny thing about having stock: I still flinch before spending. ${ctx.matTotal} mats in reserve, ${ctx.blooms} blooms, and a brain that remembers empty weeks.`,
        ]);
      }
      return pick(rng, [
        `I’m mid-climb: ${ctx.brass} brass, ${ctx.matTotal} mats on the shelf, ${ctx.blooms} blooms for frames. ${ctx.harvestRuns} hauls in the logbook — not legend, not failure.`,
        `Resources aren’t a victory parade. They’re options. Right now I hold ${ctx.brass} brass and enough scrap to keep the lights mean rather than dead.`,
        `If you must know the piles: brass ${ctx.brass}, raw stock ${ctx.matTotal}, blooms ${ctx.blooms}. The interesting part is how many times I almost sold the wrong thing.`,
        `I’ve pulled ${ctx.harvestRuns} hauls. Some days the reef feels personal. The packs come home heavier than my pride.`,
      ]);
    }

    case 'workshop': {
      const bits: string[] = [];
      if (ctx.apartment) bits.push('a sky apartment with my name on the deed');
      if (ctx.cityWorkshop) bits.push('a city workshop lease');
      if (ctx.stalls > 0) bits.push(`${ctx.stalls} stall${ctx.stalls === 1 ? '' : 's'} flying my prices`);
      bits.push(`bay wing at level ${ctx.bayLevel}`);
      const place = bits.join(', ');
      return pick(rng, [
        `My path through the city: ${place}. It sounds like bragging until you remember the empty nights that paid for it.`,
        `Workshop-wise I’m at bay L${ctx.bayLevel}${ctx.cityWorkshop ? ' with industrial keys' : ''}${ctx.apartment ? ' and a place to sleep that isn’t a crate' : ''}. ${ctx.stalls} stall front${ctx.stalls === 1 ? '' : 's'} carry my stamp.`,
        `I measure progress in leases and late nights. ${capitalize(place)}. None of it was free.`,
        `Empire snapshot without the brochure: ${place}. I’m still the kid who talked to husks — just with better doors.`,
      ]);
    }

    default:
      return 'I… don’t know how to say this yet.';
  }
}

/** Rough lower bound on persona dialogue combinations (for debug/docs). */
export function estimateRomancePersonaSpace(): number {
  return (
    SURNAMES.length *
    ORIGINS.length *
    VOCATIONS.length *
    TEMPERAMENTS.length *
    SOFT_SPOTS.length *
    FEARS.length *
    DREAMS.length *
    SPEECH.length *
    5 * // chat template picks
    4 // about line branches
  );
}
