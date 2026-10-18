#!/usr/bin/env node
// Renders resources/icon.svg to every icon the app ships:
//   public/icon-180/192/512.png         the PWA (manifest, iOS home screen, notifications)
//   resources/icon-only.png ...         the sources @capacitor/assets turns into the native
//                                       Android and iOS icons and splash screens
// Run after changing the SVG:
//   node scripts/build-icons.mjs
//   npx @capacitor/assets generate --ios --android --iconBackgroundColor '#0a0d12' --splashBackgroundColor '#0a0d12' --iconBackgroundColorDark '#0a0d12' --splashBackgroundColorDark '#0a0d12'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const res = join(root, 'resources')
const BG = '#0a0d12'
const svg = readFileSync(join(res, 'icon.svg'), 'utf8')

// The glyph alone (everything but the background square), on a 512 canvas scaled about its centre.
const glyph = svg.slice(svg.indexOf('/>', svg.indexOf('<rect width="512"')) + 2, svg.lastIndexOf('</svg>'))
const variant = (scale, bg) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
  (bg ? `<rect width="512" height="512" fill="${bg}"/>` : '') +
  `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${glyph}</g></svg>`)
const render = (input, size, out) => sharp(input, { density: 600 }).resize(size, size).png().toFile(out)

for (const size of [180, 192, 512]) {
  await render(Buffer.from(svg), size, join(root, 'public', `icon-${size}.png`))
  console.log(`public/icon-${size}.png`)
}

// Native sources. Android's adaptive icon shows only the middle 66% of its foreground and may
// crop it to a circle, so the glyph is shrunk to sit inside that; the iOS / legacy icon keeps the
// same proportions as the PWA one. Splash: the glyph small in the middle of the app background.
await render(Buffer.from(svg), 1024, join(res, 'icon-only.png'))
await render(variant(0.82, null), 1024, join(res, 'icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile(join(res, 'icon-background.png'))
for (const name of ['splash.png', 'splash-dark.png']) await render(variant(0.36, BG), 2732, join(res, name))
console.log('resources/icon-only.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png')
