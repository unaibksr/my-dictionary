import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')

const src = process.argv[2]
if (!src) {
  console.error('Usage: node scripts/apply-icon.mjs <path-to-icon.png>')
  process.exit(1)
}

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

function decodePNG(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('Not a PNG file')
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  let plte = null
  let trns = null
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    pos += 12 + len
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'PLTE') {
      plte = data
    } else if (type === 'tRNS') {
      trns = data
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }
  if (interlace !== 0) throw new Error('Interlaced PNG is not supported')
  if (bitDepth !== 8) throw new Error(`Only 8-bit PNGs are supported (got ${bitDepth}-bit)`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
  if (channels == null) throw new Error(`Unsupported color type ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(width * height * bpp)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const b = raw[rowStart + 1 + x]
      const left = x >= bpp ? cur[x - bpp] : 0
      const up = prev[x]
      const upLeft = x >= bpp ? prev[x - bpp] : 0
      let v
      if (filter === 0) v = b
      else if (filter === 1) v = b + left
      else if (filter === 2) v = b + up
      else if (filter === 3) v = b + Math.floor((left + up) / 2)
      else v = b + paeth(left, up, upLeft)
      cur[x] = v & 0xff
    }
    cur.copy(out, y * stride)
    prev = cur
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    if (colorType === 0) {
      const g = out[i]
      rgba[i * 4] = g
      rgba[i * 4 + 1] = g
      rgba[i * 4 + 2] = g
      rgba[i * 4 + 3] = 255
    } else if (colorType === 2) {
      rgba[i * 4] = out[i * 3]
      rgba[i * 4 + 1] = out[i * 3 + 1]
      rgba[i * 4 + 2] = out[i * 3 + 2]
      rgba[i * 4 + 3] = 255
    } else if (colorType === 4) {
      const g = out[i * 2]
      rgba[i * 4] = g
      rgba[i * 4 + 1] = g
      rgba[i * 4 + 2] = g
      rgba[i * 4 + 3] = out[i * 2 + 1]
    } else if (colorType === 6) {
      rgba[i * 4] = out[i * 4]
      rgba[i * 4 + 1] = out[i * 4 + 1]
      rgba[i * 4 + 2] = out[i * 4 + 2]
      rgba[i * 4 + 3] = out[i * 4 + 3]
    } else if (colorType === 3) {
      const idx = out[i]
      rgba[i * 4] = plte[idx * 3]
      rgba[i * 4 + 1] = plte[idx * 3 + 1]
      rgba[i * 4 + 2] = plte[idx * 3 + 2]
      rgba[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255
    }
  }
  return { width, height, rgba }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function resize(rgba, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy = Math.max(0, Math.min(sh - 1, ((y + 0.5) * sh) / dh - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < dw; x++) {
      const sx = Math.max(0, Math.min(sw - 1, ((x + 0.5) * sw) / dw - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0
      const di = (y * dw + x) * 4
      for (let c = 0; c < 4; c++) {
        const a = rgba[(y0 * sw + x0) * 4 + c]
        const b = rgba[(y0 * sw + x1) * 4 + c]
        const d = rgba[(y1 * sw + x0) * 4 + c]
        const e = rgba[(y1 * sw + x1) * 4 + c]
        const top = a + (b - a) * fx
        const bot = d + (e - d) * fx
        out[di + c] = Math.round(top + (bot - top) * fy)
      }
    }
  }
  return out
}

function cornerColor(rgba, size) {
  const corners = [
    [0, 0],
    [size - 1, 0],
    [0, size - 1],
    [size - 1, size - 1],
  ]
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (const [x, y] of corners) {
    const i = (y * size + x) * 4
    if (rgba[i + 3] > 128) {
      r += rgba[i]
      g += rgba[i + 1]
      b += rgba[i + 2]
      n++
    }
  }
  if (n === 0) return [18, 18, 24]
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function makeMaskable(rgba, size) {
  const inner = Math.round(size * 0.8)
  const scaled = resize(rgba, size, size, inner, inner)
  const bg = cornerColor(rgba, size)
  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = bg[0]
    out[i * 4 + 1] = bg[1]
    out[i * 4 + 2] = bg[2]
    out[i * 4 + 3] = 255
  }
  const off = Math.floor((size - inner) / 2)
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const s = (y * inner + x) * 4
      const d = ((y + off) * size + (x + off)) * 4
      out[d] = scaled[s]
      out[d + 1] = scaled[s + 1]
      out[d + 2] = scaled[s + 2]
      out[d + 3] = scaled[s + 3]
    }
  }
  return out
}

const buf = readFileSync(src)
const { width, height, rgba } = decodePNG(buf)
if (width !== height) console.warn(`Note: source is ${width}x${height}, not square.`)

const at512 = resize(rgba, width, height, 512, 512)
writeFileSync(join(outDir, 'pwa-512.png'), encodePNG(512, at512))
writeFileSync(join(outDir, 'pwa-192.png'), encodePNG(192, resize(rgba, width, height, 192, 192)))
writeFileSync(join(outDir, 'apple-touch-icon.png'), encodePNG(180, resize(rgba, width, height, 180, 180)))
writeFileSync(join(outDir, 'favicon.png'), encodePNG(64, resize(rgba, width, height, 64, 64)))
writeFileSync(join(outDir, 'maskable-512.png'), encodePNG(512, makeMaskable(at512, 512)))

console.log('Done. Wrote pwa-512, pwa-192, maskable-512, apple-touch-icon, favicon.png to public/')
