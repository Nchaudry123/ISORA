#!/usr/bin/env node
// Renders resources/icon.svg to the PWA icons in public/ (192/512 for the manifest, 180 for the
// iOS home screen). Run after changing the SVG: node scripts/build-icons.mjs
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'resources', 'icon.svg')
for (const size of [180, 192, 512]) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(join(root, 'public', `icon-${size}.png`))
  console.log(`public/icon-${size}.png`)
}
