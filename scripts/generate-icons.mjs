import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')

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
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

const covRoundRect = (px, py, cx, cy, hw, hh, r) =>
  clamp01(0.5 - sdRoundRect(px, py, cx, cy, hw, hh, r))

function mix(base, top, cov) {
  if (cov <= 0) return base
  if (cov >= 1) return top
  return [
    lerp(base[0], top[0], cov),
    lerp(base[1], top[1], cov),
    lerp(base[2], top[2], cov),
  ]
}

const INDIGO_TOP = [99, 102, 241]
const INDIGO_BOTTOM = [79, 70, 229]
const WHITE = [255, 255, 255]
const ACCENT = [99, 102, 241]

function render(size, { rounded = true, glyphScale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  const c = size / 2
  const radius = rounded ? Math.round(size * 0.225) : 0
  const s = size * glyphScale

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5
      const fy = y + 0.5
      const i = (y * size + x) * 4

      const bgCov = rounded ? covRoundRect(fx, fy, c, c, c, c, radius) : 1

      if (bgCov <= 0) {
        rgba[i] = 0
        rgba[i + 1] = 0
        rgba[i + 2] = 0
        rgba[i + 3] = 0
        continue
      }

      const t = fy / size
      let col = [
        lerp(INDIGO_TOP[0], INDIGO_BOTTOM[0], t),
        lerp(INDIGO_TOP[1], INDIGO_BOTTOM[1], t),
        lerp(INDIGO_TOP[2], INDIGO_BOTTOM[2], t),
      ]

      col = mix(col, WHITE, covRoundRect(fx, fy, c, c, s * 0.22, s * 0.24, s * 0.035))

      col = mix(col, ACCENT, covRoundRect(fx, fy, c, c, s * 0.013, s * 0.2, s * 0.0065))

      const lineYs = [-0.11, 0, 0.11]
      const lineHw = s * 0.09
      const lineHh = s * 0.014
      const lineR = s * 0.007
      const leftCx = c - s * 0.12
      const rightCx = c + s * 0.12
      for (const ly of lineYs) {
        const yc = c + ly * s
        col = mix(col, ACCENT, covRoundRect(fx, fy, leftCx, yc, lineHw, lineHh, lineR))
        col = mix(col, ACCENT, covRoundRect(fx, fy, rightCx, yc, lineHw, lineHh, lineR))
      }

      rgba[i] = Math.round(col[0])
      rgba[i + 1] = Math.round(col[1])
      rgba[i + 2] = Math.round(col[2])
      rgba[i + 3] = Math.round(bgCov * 255)
    }
  }
  return rgba
}

const jobs = [
  { file: 'pwa-192.png', size: 192 },
  { file: 'pwa-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, rounded: false, glyphScale: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
]

mkdirSync(outDir, { recursive: true })
for (const job of jobs) {
  const rgba = render(job.size, {
    rounded: job.rounded !== false,
    glyphScale: job.glyphScale ?? 1,
  })
  writeFileSync(join(outDir, job.file), encodePNG(job.size, rgba))
  console.log(`wrote ${job.file}`)
}
