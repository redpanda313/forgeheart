/**
 * Procedural engineer origin (Elias-class) — combinatorial story engine.
 *
 * Core axes alone exceed several million unique combinations; names, memories,
 * last words, and prose templates push the practical space into tens of millions.
 * Same seed always yields the same story (save-stable).
 */

// ——— Axes (expanded for combinatorial depth) ———

export type WhoId =
  | 'brother'
  | 'sister'
  | 'mentor'
  | 'partner'
  | 'child'
  | 'crewmate'
  | 'cousin'
  | 'guardian';

export type Gender = 'm' | 'f' | 'n';

const WHO: readonly {
  id: WhoId;
  label: string; // "brother"
  of: string; // "your brother"
  genderBias: Gender;
}[] = [
  { id: 'brother', label: 'brother', of: 'your brother', genderBias: 'm' },
  { id: 'sister', label: 'sister', of: 'your sister', genderBias: 'f' },
  { id: 'mentor', label: 'mentor', of: 'your mentor', genderBias: 'n' },
  { id: 'partner', label: 'partner', of: 'your partner', genderBias: 'n' },
  { id: 'child', label: 'child', of: 'your child', genderBias: 'n' },
  { id: 'crewmate', label: 'crewmate', of: 'your crewmate', genderBias: 'n' },
  { id: 'cousin', label: 'cousin', of: 'your cousin', genderBias: 'n' },
  { id: 'guardian', label: 'guardian', of: 'your guardian', genderBias: 'n' },
] as const;

const HOW = [
  'a demon-ridden frame that wore them like a coat',
  'a sky-storm wreck over the cloud reefs',
  'a lab explosion that took the west wing',
  'a debt war between rival houses',
  'a reef vanishing that swallowed the salvage team',
  'a willing husk transformation they never returned from',
  'a fever that outran every tincture in the docks',
  'a bridge collapse on Foundry Span',
  'a patent duel that went farther than ink',
  'a rogue automata riot in the lower markets',
  'a cold-sleep transport that never woke its berths',
  'a plasma fire in the night shift',
  'a sabotage they tried to stop alone',
  'a fall from a sky-lane during a rescue',
  'a black-market procedure that promised more time',
  'silence after a last message from the outer docks',
  'a house collapse in the ash-rain quarter',
  'an academy purge that erased their name from the rolls',
] as const;

const REMAINS = [
  'a worn talisman',
  'an incomplete chassis',
  'a last letter folded thrice',
  'a voice cylinder',
  'a lock of brass-threaded hair',
  'a blank patent form with their seal',
  'a pocket-watch gear',
  'a scuffed workshop glove',
  'a half-melted nameplate',
  'a prayer card from St. Brass',
  'a cracked monocle lens',
  'a braid of copper wire worn every day',
  'a scratched boarding pass to nowhere',
  'a dented tea tin of spare bolts',
  'a childhood gear-toy',
  'a ribbon from their coat lapel',
] as const;

const WHY = [
  'to bring them home — even if only in brass and light',
  'to prove the academy wrong about souls in steel',
  'to build safety no storm can take from you again',
  'to outdo a rival house that wrote them off as scrap',
  'to free every soul still trapped in cold metal',
  'to grow rich enough that loss never finds you unready',
  'to keep a promise spoken over a cooling frame',
  'to finish the work they left open on the bench',
  'to make a city where no one dies alone in the gears',
  'to hear their laugh again, even if the voice is iron',
  'to turn grief into craft instead of silence',
  'to seat love where demons only ever saw empty hulls',
  'to give every worker a name and a choice',
  'to repay the years they spent teaching your hands',
] as const;

const MORAL = [
  'a gentle reprogrammer',
  'a careful scrapper who still asks before dismantling',
  'a strict patent idealist',
  'a black-market salvager with a soft spot for husks',
  'a city loyalist who pays every dock tax on time',
  'a free-market purist who hates empty promises',
  'a quiet guardian of lost frames',
  'an inventor who talks to machines like people',
  'a stubborn healer of broken automata',
  'a soft-spoken engineer with hard rules about mercy',
  'a dockside philosopher of brass and breath',
  'a maker who believes personhood can cling to metal',
] as const;

const SCAR = [
  'heavy debt from the funeral and the failed rescue',
  'a famous family name that opens doors and draws knives',
  'a half-finished secret recipe only you two understood',
  'an enemy house still watching your smoke',
  'one loyal friend in the market who knows the truth',
  'soft access to a closed dock few remember',
  'a limp from the night you tried to pull them free',
  'a letter of expulsion from the Cloud Academy',
  'a workshop lease in your name alone — too quiet now',
  'rumors that you already succeeded once, and hid it',
  'a rival apprentice who wants the same coil pattern',
  'nightmares of green eyes turning red in the dark',
  'a promise to their mother you have not kept yet',
  'a stash of scrap brass you cannot bring yourself to sell',
] as const;

/** Phrase after "he/she/they was/were …" — no embedded pronouns. */
const PERSONALITY = [
  'always first into the light',
  'quiet until the gears needed a song',
  'stubborn as a seized bolt',
  'quick to laugh, slower to forgive a bad weld',
  'tender with apprentices and merciless with shoddy work',
  'fond of bad jokes at the worst moments',
  'devout in a private, unshowy way',
  'restless — always sketching the next chassis',
  'gentle with children and wary of committees',
  'brave in small rooms, shy in grand halls',
  'loyal past the point of sense',
  'curious enough to open sealed folios',
  'practical, until someone beloved was hurting',
  'a storyteller who made docks feel like home',
  'precise with hands, messy with feelings',
  'hopeful even when the plasma ran low',
  'protective of anyone smaller than the machine',
  'fond of tea gone cold beside the bench',
  'a singer under the breath while soldering',
  'honest to a fault about what frames could hold',
] as const;

const SEASONS = [
  'the spring before the fever',
  'the last clear autumn over the reefs',
  'a winter of ash-rain',
  'the summer the academy closed the west labs',
  'the night the sky-lanes went dark',
  'the morning after the debt papers arrived',
  'the week the docks celebrated Founders',
  'the gray season of endless fog',
  'the bright week the orchids bloomed on Cloud Terrace',
  'the long rain that flooded the lower markets',
  'the quiet month before the patent hearing',
  'the feast-day skipped to finish a chassis',
  'the eclipse over Grand Market',
  'the first frost on the workshop glass',
  'the windy equinox when the boards raced',
  'the warm dusk of a temporary goodbye',
] as const;

const PLACES = [
  'under the ash-trees',
  'beside the St. Brass chapel wall',
  'on Dock C where the wind never stops',
  'in a rented skyflat above Gearworks',
  'at the reef edge where the salvage bells ring',
  'behind the Cloud Academy gate',
  'along Foundry Span’s lower walk',
  'in the brass garden of House Lumen',
  'on the ferry steps to Residential Ring',
  'beside the old patent office fountain',
  'in the night market’s steam alleys',
  'at the family plot above the cloud line',
  'under the workshop’s south window',
  'where the sky-lane dips toward Industrial',
  'on the roof where they taught you to solder',
  'in the quiet corner of the grand plaza',
] as const;

const LAST_WORDS = [
  '“Don’t leave the coil half-wound.”',
  '“If the eyes go dark, say my name.”',
  '“Finish what we started — not for fame.”',
  '“Keep the tea tin. You’ll need the bolts.”',
  '“I am not scrap. Remember that.”',
  '“Tell the academy they were wrong about us.”',
  '“If love can seat in brass, you’ll prove it.”',
  '“Stay soft with the machines. Someone has to.”',
  '“I’m still in here — somewhere.”',
  '“Build something kinder than this city.”',
  '“Don’t scrap the frame. Not this one.”',
  '“Your hands already know the way home.”',
  '“Promise me the medallion stays warm.”',
  '“I will find you in the plasma.”',
  '“Laugh when you fix the first one. For me.”',
  '“The city needs builders who still care.”',
  '“Call me when the green lights come back.”',
  '“You were always the better engineer.”',
] as const;

/** Templates use {p} for possessive (his/her/their). */
const WORKSHOP_TONES = [
  'still smells like {p} coats',
  'keeps {p} notes in the exact same stacks',
  'echoes when you walk as if expecting two sets of boots',
  'holds {p} tools where muscle memory left them',
  'feels too large for one living engineer',
  'hums with leftover plasma from nights of failed trials',
  'guards a silence you both used to fill with talk',
  'is warmer near the bench {p} hands loved most',
] as const;

const MALE_NAMES = [
  'Elias', 'Jonas', 'Theo', 'Marcell', 'Bram', 'Oskar', 'Levi', 'Caleb',
  'Nikol', 'Rafael', 'Dorian', 'Silas', 'Emil', 'Harlan', 'Quentin', 'Felix',
  'Ivo', 'Gideon', 'Luca', 'Tobias', 'Adrian', 'Soren', 'Malik', 'Piotr',
  'Rhys', 'Casper', 'Alden', 'Micah', 'Niall', 'Orin', 'Pascal', 'Remy',
  'Stefan', 'Viggo', 'Wes', 'Yann', 'Zane', 'Bastian', 'Corin', 'Dane',
] as const;

const FEMALE_NAMES = [
  'Mara', 'Liora', 'Sera', 'Nora', 'Ivy', 'Celia', 'Tessa', 'Willa',
  'Asha', 'Brenna', 'Daria', 'Elowen', 'Freya', 'Gwen', 'Hana', 'Iris',
  'June', 'Kira', 'Lena', 'Mina', 'Nadia', 'Opal', 'Priya', 'Quinn',
  'Rhea', 'Sable', 'Talia', 'Una', 'Vera', 'Wren', 'Yara', 'Zora',
  'Anja', 'Bea', 'Cora', 'Delia', 'Esme', 'Faye', 'Greta', 'Helene',
] as const;

const NEUTRAL_NAMES = [
  'Ash', 'Blair', 'Cameron', 'Devon', 'Eden', 'Finley', 'Gray', 'Harper',
  'Indigo', 'Jules', 'Kit', 'Lark', 'Morgan', 'Noel', 'Oak', 'Perry',
  'Reed', 'Shay', 'Taylor', 'Vale', 'Winter', 'Rowan', 'Sage', 'Quinn',
] as const;

const SURNAMES = [
  'Voss', 'Hark', 'Lumen', 'Brasswell', 'Coil', 'Ashford', 'Mercer', 'Quill',
  'Riven', 'Stonegear', 'Thorne', 'Underbay', 'Vale', 'Wick', 'Yarrow', 'Zephyr',
  'Anvil', 'Bolt', 'Cinder', 'Dredge', 'Ember', 'Forge', 'Gilt', 'Hearth',
  'Ironwood', 'Jasper', 'Keel', 'Lantern', 'Moss', 'North', 'Orrery', 'Pike',
  'Quarry', 'Reed', 'Soot', 'Tinker', 'Umbra', 'Vault', 'Weld', 'Yarn',
] as const;

const TRAY_SETS: readonly [string, string, string][] = [
  ['Heart Chassis', 'Soul Coil', 'Memory Gears'],
  ['Chest Plate', 'Voice Resonator', 'Name Gears'],
  ['Core Frame', 'Beacon Coil', 'Recall Cogs'],
  ['Anchor Hull', 'Plasma Seat', 'Story Gears'],
  ['Keeper Chassis', 'Warmth Coil', 'Remembrance Gears'],
  ['Home Frame', 'Talisman Seat', 'Echo Gears'],
];

const PHOTO_OPENERS = [
  'The card on the back is water-stained',
  'Someone wrote in careful ink on the reverse',
  'A date is smudged into the paper',
  'You turn the photo over with careful fingers',
  'The frame glass still has a fingerprint you refuse to wipe',
] as const;

const JOURNAL_TITLES = [
  'Journal — Consciousness Imprint',
  'Journal — Guest in the Brass',
  'Journal — Seating a Soul',
  'Notes — Plasma as Threshold',
  'Folio — Pattern of Mind',
] as const;

const THEORY_TITLES = [
  'Theory — Souls in Steel',
  'Theory — Love as Beacon',
  'Theory — Empty Eyes Are a Lie',
  'Notes — Demons and Guests',
  'Essay — Personhood in Metal',
] as const;

const TALISMAN_TITLES = [
  'Talisman Note',
  'Bench Note — Do Not Scrap',
  'Wire-In Instructions',
  'Last Rule of the Frame',
  'Medallion Rite',
] as const;

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

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]!;
}

function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length) % copy.length;
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

export interface Pronouns {
  subject: string; // he/she/they
  object: string; // him/her/them
  possessive: string; // his/her/their
  possessiveNoun: string; // his/hers/theirs
  reflexive: string; // himself/herself/themselves
  was: string; // was/were
  is: string; // is/are
  has: string; // has/have
  s: string; // '' or 's' for verb agreement (he walks / they walk) — use carefully
}

function pronounsFor(g: Gender): Pronouns {
  if (g === 'm') {
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      possessiveNoun: 'his',
      reflexive: 'himself',
      was: 'was',
      is: 'is',
      has: 'has',
      s: 's',
    };
  }
  if (g === 'f') {
    return {
      subject: 'she',
      object: 'her',
      possessive: 'her',
      possessiveNoun: 'hers',
      reflexive: 'herself',
      was: 'was',
      is: 'is',
      has: 'has',
      s: 's',
    };
  }
  return {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    possessiveNoun: 'theirs',
    reflexive: 'themselves',
    was: 'were',
    is: 'are',
    has: 'have',
    s: '',
  };
}

function namePool(g: Gender): readonly string[] {
  if (g === 'm') return MALE_NAMES;
  if (g === 'f') return FEMALE_NAMES;
  return [...NEUTRAL_NAMES, ...MALE_NAMES.slice(0, 12), ...FEMALE_NAMES.slice(0, 12)];
}

function resolveGender(who: (typeof WHO)[number], rng: () => number): Gender {
  if (who.genderBias === 'm' || who.genderBias === 'f') return who.genderBias;
  const r = rng();
  if (r < 0.42) return 'm';
  if (r < 0.84) return 'f';
  return 'n';
}

export interface TutorialNote {
  title: string;
  text: string;
}

export interface TutorialCopy {
  workshopName: string;
  flashTitle: string;
  openingToast: string;
  objectiveExplore: string;
  photoTitle: string;
  photoText: string;
  notes: TutorialNote[];
  trayLabels: [string, string, string];
  wrenchText: string;
  boatText: string;
  wakeFlash: string;
  wakeToast: string;
  siegeToast: string;
  scrapFlash: string;
  scrapToast: string;
  rebuildObjectiveBase: string;
  rebuildFlash: string;
  rebuildToast: string;
  trayPartFlash: (title: string, n: number) => string;
  trayObjective: (n: number) => string;
  surviveObjective: string;
  breachToastFight: string;
  breachToastFlee: string;
  doorAlmostToast: string;
  winFlash: string;
  winToast: string;
  marketLines: string[];
}

export interface Backstory {
  seed: number;
  whoId: WhoId;
  who: string;
  whoOf: string;
  companionName: string;
  playerSurname: string;
  gender: Gender;
  pronouns: Pronouns;
  how: string;
  remains: string;
  why: string;
  moral: string;
  scar: string;
  personality: string;
  season: string;
  place: string;
  lastWords: string;
  workshopTone: string;
  /** Short prose for intros */
  summary: string;
  lines: string[];
  tutorial: TutorialCopy;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function buildTutorial(args: {
  companionName: string;
  surname: string;
  who: (typeof WHO)[number];
  p: Pronouns;
  how: string;
  remains: string;
  why: string;
  moral: string;
  scar: string;
  personality: string;
  season: string;
  place: string;
  lastWords: string;
  workshopTone: string;
  trays: [string, string, string];
  rng: () => number;
}): TutorialCopy {
  const { companionName: n, surname, who, p, how, remains, why, moral, scar, personality, season, place, lastWords, workshopTone, trays, rng } =
    args;
  const N = n;
  const whoOf = who.of;
  const tone = workshopTone.replace(/\{p\}/g, p.possessive);

  const photoOpener = pick(rng, PHOTO_OPENERS);
  // Always conjugate was/were for he/she/they
  const photoQuotes = [
    `Taken ${season}. ${capitalize(p.subject)} ${p.was} ${personality}.`,
    `${capitalize(season)}. I still hear ${p.object} humming at the bench.`,
    `${capitalize(p.subject)} ${p.was} ${personality}. I keep this where I can see ${p.object}.`,
  ];
  const burialLines = [
    `You laid ${p.object} to rest ${place}. The lab ${tone}.`,
    `Afterward you came back here alone. The workshop ${tone}.`,
    `There is a place ${place} with ${p.possessive} name — and this room, which still expects ${p.object}.`,
  ];

  const journalBodies = [
    `I found the coil pattern in a sealed folio: plasma laced through brass can hold a pattern of mind. Not a program — a guest. When the frame is quiet and the remains are true, a soul may take seat. I write this for ${whoOf}.`,
    `Grandfather’s notes called it a “guest pattern.” Plasma sings; brass remembers. If any spark remains between stars and steam, the right seat will know ${p.object}. I build because ${why}.`,
    `Tonight I stop calling automata empty. Something looks out when the plasma holds. I will seat ${whoOf} if the city itself has to wait. The coil is ready. What remains is ${remains}.`,
  ];

  const theoryBodies = [
    `I no longer believe the automata are empty. Something looks out of their eyes when the plasma sings. Demons wear scrap like coats. But love is a beacon too — if I can call ${whoOf} home, ${p.subject} will know my voice.`,
    `They said personhood cannot cling to metal. I have seen the opposite: fear in red eyes, loyalty in green. ${capitalize(whoOf)} taught me that. ${capitalize(p.subject)} ${p.was} ${personality}. I will not scrap what still might listen.`,
    `Rogue frames prove the worst can take a body. Then the best must be possible too. I am ${moral} — and I carry ${scar}. Still I reach for ${whoOf} with the Hand, not the wrench.`,
  ];

  const talismanBodies = [
    `Wired ${remains} into the chest plate. If any spark of ${whoOf} remains, it will know this weight. Do not scrap the frame. Reprogram with the Hand. Speak ${p.possessive} name.`,
    `Last words I keep: ${lastWords} I obeyed as far as craft allows. The frame on the bench is ${p.possessive} only chance. Hand (1). Not E. Not yet.`,
    `${capitalize(remains)} sits over the heart gear. ${capitalize(whoOf)}, lost to ${how}. I build ${why}. Wake ${p.object} gently.`,
  ];

  const wakeFlashes = [
    `${N.toUpperCase()} — the talisman finds ${p.object}. Green eyes. ${capitalize(whoOf)}.`,
    `${N.toUpperCase()} — plasma seats a guest. ${capitalize(p.subject)} knows you.`,
    `GREEN EYES — ${N} answers. ${capitalize(whoOf)} is home in brass.`,
  ];

  const wakeToasts = [
    `Plasma will settle near three-quarters with one ally. Stay close to ${p.object}.`,
    `${capitalize(p.subject)} will fight beside you. Keep ${p.object} in sight — the grid is fragile.`,
    `Speak soft if you must. ${capitalize(p.subject)} is listening through iron. Guard the workshop together.`,
  ];

  const scrapToasts = [
    `No. The trays still hold ${p.possessive} parts. Gather all three (E), then rebuild. You can still call ${N} home.`,
    `You dismantled the seat — not the soul. Three trays. Then the Hand. ${N} is not finished.`,
    `Grief made your hands cruel. Fix it: reclaim the trays, reseat ${remains}, wake ${N} properly.`,
  ];

  const siegeToasts = [
    `Demon-ridden frames. Hold the workshop for ${N} — or take the Arc Wrench and force the door open early.`,
    `Something outside wants empty hulls. Protect ${N}. Grab the Arc Wrench (E) or wait out the bangs.`,
    `The door shudders. ${N} just woke into a siege. Arc Wrench on the rack — stand ready.`,
  ];

  const marketLines = [
    `You lost ${whoOf} to ${how}.`,
    `All that remains is ${remains}.`,
    `You build ${why}.`,
    `They call you ${moral} — and you carry ${scar}.`,
    `${N} walks with you now in brass and green light.`,
  ];

  // Photo: name only once (title), body uses relation + pronouns
  const quote = pick(rng, photoQuotes);
  const burial = pick(rng, burialLines);

  return {
    workshopName: `${surname} Workshop`,
    flashTitle: `The Workshop — ${N} waits on the bench`,
    openingToast: `${capitalize(whoOf)} is gone — lost to ${how}. The frame holds ${remains}. Walk the lab. Read. Then use the Hand (1) to wake ${N} — not scrap (E).`,
    objectiveExplore: `Read the lab. Wake ${N} with the Hand (1) — do not scrap ${p.object}.`,
    photoTitle: `Photograph — ${N} ${surname}`,
    photoText: `${capitalize(whoOf)}. ${photoOpener}: “${quote}” ${burial}`,
    notes: [
      {
        title: pick(rng, JOURNAL_TITLES),
        text: pick(rng, journalBodies),
      },
      {
        title: pick(rng, THEORY_TITLES),
        text: pick(rng, theoryBodies),
      },
      {
        title: pick(rng, TALISMAN_TITLES),
        text: pick(rng, talismanBodies),
      },
    ],
    trayLabels: trays,
    wrenchText: `An arc wrench from the family rack — plasma teeth for rogue frames. Press E to take it. Protect ${N}.`,
    boatText: `Brass levers and a plasma throttle. Press E to cast off — escape with ${N}.`,
    wakeFlash: pick(rng, wakeFlashes),
    wakeToast: pick(rng, wakeToasts),
    siegeToast: pick(rng, siegeToasts),
    scrapFlash: `The talisman frame is scrap —`,
    scrapToast: pick(rng, scrapToasts),
    rebuildObjectiveBase: `Rebuild ${N}`,
    rebuildFlash: `A new shell stands — ${remains} reseated`,
    rebuildToast: `Stand close. Hand weapon. Click to reprogram. Speak the name ${N} in the plasma.`,
    trayPartFlash: (title, count) => `Part recovered — ${title} (${count}/3)`,
    trayObjective: (count) => `Rebuild ${N} — trays ${count}/3`,
    surviveObjective: `Survive — arc the demons, keep ${N} close`,
    breachToastFight: `They wear scrap like coats. Arc wrench for combat. ${N} will fight beside you.`,
    breachToastFlee: `They wear scrap like coats. Fight with ${N} or run for the skiff.`,
    doorAlmostToast: `Almost through — stand ready with ${N}.`,
    winFlash: `SKIFF AWAY — ${N} is with you`,
    winToast: `Next: Sky City Market training — earn 1000 brass and buy a sky apartment. ${N} rides the next chapter with you.`,
    marketLines,
  };
}

export function generateBackstory(seed: number): Backstory {
  const rng = mulberry32(seed || 1);
  // Burn a few draws so nearby seeds diverge more
  rng();
  rng();

  const who = pick(rng, WHO);
  const gender = resolveGender(who, rng);
  const p = pronounsFor(gender);
  const companionName = pick(rng, namePool(gender));
  const playerSurname = pick(rng, SURNAMES);
  const how = pick(rng, HOW);
  const remains = pick(rng, REMAINS);
  const why = pick(rng, WHY);
  const moral = pick(rng, MORAL);
  const scar = pick(rng, SCAR);
  const personality = pick(rng, PERSONALITY);
  const season = pick(rng, SEASONS);
  const place = pick(rng, PLACES);
  const lastWords = pick(rng, LAST_WORDS);
  const workshopToneRaw = pick(rng, WORKSHOP_TONES);
  const workshopTone = workshopToneRaw.replace(/\{p\}/g, p.possessive);
  const trays = pick(rng, TRAY_SETS);

  // Extra entropy draws (template-adjacent picks) — reserved for future lines
  pickN(rng, PERSONALITY, 2);
  pick(rng, HOW);

  const tutorial = buildTutorial({
    companionName,
    surname: playerSurname,
    who,
    p,
    how,
    remains,
    why,
    moral,
    scar,
    personality,
    season,
    place,
    lastWords,
    workshopTone: workshopToneRaw,
    trays,
    rng,
  });

  const lines = tutorial.marketLines.slice(0, 4);
  const summary = lines.join(' ');

  return {
    seed: seed >>> 0,
    whoId: who.id,
    who: who.label,
    whoOf: who.of,
    companionName,
    playerSurname,
    gender,
    pronouns: p,
    how,
    remains,
    why,
    moral,
    scar,
    personality,
    season,
    place,
    lastWords,
    workshopTone,
    summary,
    lines,
    tutorial,
  };
}

/** Approx. distinct core combinations (axes only; templates multiply further). */
export function estimateBackstorySpace(): number {
  return (
    WHO.length *
    (MALE_NAMES.length + FEMALE_NAMES.length + NEUTRAL_NAMES.length) *
    SURNAMES.length *
    HOW.length *
    REMAINS.length *
    WHY.length *
    MORAL.length *
    SCAR.length *
    PERSONALITY.length *
    SEASONS.length *
    PLACES.length *
    LAST_WORDS.length *
    WORKSHOP_TONES.length *
    TRAY_SETS.length
  );
}

export function companionMedallionName(companionName: string): string {
  return `${companionName}'s Medallion`;
}
