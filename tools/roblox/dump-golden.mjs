#!/usr/bin/env node
/**
 * Write roblox/tests/golden/robot.json from the ROBOT table in robot.ts.
 * The table is plain data; this does not load Three.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/forgeheart/robot.ts'), 'utf8');
const start = src.indexOf('export const ROBOT = ');
const end = src.indexOf('} as const;', start);
if (start < 0 || end < 0) {
  console.error('ROBOT table not found');
  process.exit(1);
}
const body = src.slice(start + 'export const ROBOT = '.length, end + 1).replaceAll('as const', '');
const ROBOT = Function(`"use strict"; return (${body});`)();
const out = path.join(root, 'roblox/tests/golden/robot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ROBOT, null, 2) + '\n');
console.log('wrote', path.relative(root, out));
