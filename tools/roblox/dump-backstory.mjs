#!/usr/bin/env node
/** Golden stories from the browser generator, for the Luau port. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { generateBackstory, estimateBackstorySpace } = await import(
  path.join(root, 'src/forgeheart/backstory.ts')
);

const seeds = [0, 1, 2, 7, 42, 1000, 99991, 4294967295];
const stories = seeds.map((seed) => {
  const story = generateBackstory(seed);
  const tutorial = { ...story.tutorial };
  tutorial.trayPartFlashSample = tutorial.trayPartFlash(tutorial.trayLabels[0], 2);
  tutorial.trayObjectiveSample = tutorial.trayObjective(2);
  delete tutorial.trayPartFlash;
  delete tutorial.trayObjective;
  return {
    seed: story.seed,
    whoId: story.whoId,
    who: story.who,
    whoOf: story.whoOf,
    companionName: story.companionName,
    playerSurname: story.playerSurname,
    gender: story.gender,
    pronouns: story.pronouns,
    how: story.how,
    remains: story.remains,
    why: story.why,
    moral: story.moral,
    scar: story.scar,
    personality: story.personality,
    season: story.season,
    place: story.place,
    lastWords: story.lastWords,
    workshopTone: story.workshopTone,
    summary: story.summary,
    lines: story.lines,
    tutorial,
  };
});

const out = {
  space: estimateBackstorySpace(),
  stories,
};
const dest = path.join(root, 'roblox/tests/golden/backstories.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', stories.length, 'stories');
