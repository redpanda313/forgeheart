#!/usr/bin/env node
/**
 * Upload roblox/build/ForgeHeart.rbxl to the private start place.
 * The API key is read from FORGEHEART_ROBLOX_API_KEY or
 * ~/.config/forgeheart/roblox-open-cloud.key. It is never written to the repo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const place = JSON.parse(fs.readFileSync(path.join(root, 'roblox/place.json'), 'utf8'));
const file = path.join(root, 'roblox/build/ForgeHeart.rbxl');
const keyPath = path.join(os.homedir(), '.config/forgeheart/roblox-open-cloud.key');
const key = (process.env.FORGEHEART_ROBLOX_API_KEY || fs.readFileSync(keyPath, 'utf8')).trim();

const url = `https://apis.roblox.com/universes/v1/${place.universeId}/places/${place.startPlaceId}/versions?versionType=Published`;
const body = fs.readFileSync(file);
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'x-api-key': key,
    'Content-Type': 'application/octet-stream',
  },
  body,
});
const text = await res.text();
if (!res.ok) {
  console.error('publish failed', res.status, text.slice(0, 500));
  process.exit(1);
}
console.log('published', text);
