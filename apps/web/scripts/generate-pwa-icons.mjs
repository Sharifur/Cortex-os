// Renders public/favicon.svg to PNG icons for the PWA manifest + Apple
// touch icon. Pure WASM via @resvg/resvg-js — no native build deps.
//
// Run via: npm --workspace=apps/web run pwa:icons
// Also runs automatically as part of `prebuild` so production deploys
// always ship fresh icons.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'public');
const svg = readFileSync(resolve(publicDir, 'favicon.svg'), 'utf8');

const TARGETS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of TARGETS) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: '#0c1322',
  })
    .render()
    .asPng();
  writeFileSync(resolve(publicDir, name), png);
  console.log(`generated public/${name} (${size}×${size})`);
}
