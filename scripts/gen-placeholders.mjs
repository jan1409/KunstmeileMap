// Generates neutral placeholder PNGs for every screenshot in the manifest, so
// the docs render without broken images before real screenshots are captured.
// Running `pnpm docs:shots` (Playwright) later overwrites these with real UI
// captures. Safe to re-run; it only (re)writes files that are missing unless
// you pass --force.
//
// Usage: node scripts/gen-placeholders.mjs [--force]

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCREENSHOTS, DESKTOP, MOBILE } from './screenshots.manifest.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'public', 'assets', 'screenshots')
const FORCE = process.argv.includes('--force')

// --- Minimal PNG encoder (truecolor, no alpha) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function solidPng(width, height, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  // bytes 10-12 already 0 (compression, filter, interlace)

  const rowLen = width * 3
  const raw = Buffer.alloc((rowLen + 1) * height)
  for (let y = 0; y < height; y++) {
    const off = y * (rowLen + 1)
    raw[off] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  const idat = deflateSync(raw, { level: 6 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

let created = 0
let skipped = 0
for (const shot of SCREENSHOTS) {
  const target = join(OUT_DIR, shot.path)
  if (!FORCE && existsSync(target)) {
    skipped++
    continue
  }
  mkdirSync(dirname(target), { recursive: true })
  const { width, height } = shot.viewport === 'mobile' ? MOBILE : DESKTOP
  // Light neutral gray placeholder.
  writeFileSync(target, solidPng(width, height, [228, 230, 235]))
  created++
}

console.log(`Placeholders: ${created} created, ${skipped} kept.`)
