#!/usr/bin/env node
/**
 * Emit roblox/src/shared/BackstoryData.luau from the const tables in backstory.ts.
 * Logic stays in Backstory.luau so a seed produces the same story as the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/forgeheart/backstory.ts'), 'utf8');

function sliceConst(name) {
  const token = `const ${name}`;
  const at = src.indexOf(token);
  if (at < 0) throw new Error(`missing ${name}`);
  const eq = src.indexOf('=', at);
  const start = src.indexOf('[', eq);
  let i = start;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  let body = src.slice(start, i);
  body = body.replaceAll(' as const', '');
  return Function(`"use strict"; return (${body});`)();
}

const names = [
  'WHO',
  'HOW',
  'REMAINS',
  'WHY',
  'MORAL',
  'SCAR',
  'PERSONALITY',
  'SEASONS',
  'PLACES',
  'LAST_WORDS',
  'WORKSHOP_TONES',
  'MALE_NAMES',
  'FEMALE_NAMES',
  'NEUTRAL_NAMES',
  'SURNAMES',
  'TRAY_SETS',
  'PHOTO_OPENERS',
  'JOURNAL_TITLES',
  'THEORY_TITLES',
  'TALISMAN_TITLES',
];

const data = {};
for (const name of names) data[name] = sliceConst(name);

function luaString(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}

function luaValue(value, indent) {
  if (typeof value === 'string') return luaString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '{}';
    const pad = ' '.repeat(indent);
    const inner = ' '.repeat(indent + 2);
    const lines = value.map((item) => `${inner}${luaValue(item, indent + 2)},`);
    return `{\n${lines.join('\n')}\n${pad}}`;
  }
  if (value && typeof value === 'object') {
    const pad = ' '.repeat(indent);
    const inner = ' '.repeat(indent + 2);
    const lines = Object.entries(value).map(([key, item]) => `${inner}${key} = ${luaValue(item, indent + 2)},`);
    return `{\n${lines.join('\n')}\n${pad}}`;
  }
  throw new Error(`bad value ${value}`);
}

let out = '-- Generated from src/forgeheart/backstory.ts. Do not edit by hand.\n';
out += 'local BackstoryData = {\n';
for (const name of names) {
  out += `  ${name} = ${luaValue(data[name], 2)},\n`;
}
out += '}\n\nreturn BackstoryData\n';

const dest = path.join(root, 'roblox/src/shared/BackstoryData.luau');
fs.writeFileSync(dest, out);
console.log('wrote', path.relative(root, dest), 'bytes', out.length);
