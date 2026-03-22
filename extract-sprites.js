const fs = require('fs');
const zlib = require('zlib');

// ── PNG Decoder ──────────────────────────────────────────────────────
function decodePNG(filepath) {
  const buf = fs.readFileSync(filepath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25]; // 6=RGBA, 2=RGB

  let pos = 8;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') idats.push(buf.slice(pos + 8, pos + 8 + len));
    if (type === 'IEND') break;
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      let v = raw[src + i];
      const a = i >= bpp ? pixels[dst + i - bpp] : 0;
      const b = y > 0 ? pixels[dst - stride + i] : 0;
      const c = (i >= bpp && y > 0) ? pixels[dst - stride + i - bpp] : 0;
      if (filter === 1) v = (v + a) & 0xFF;
      else if (filter === 2) v = (v + b) & 0xFF;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xFF;
      else if (filter === 4) {
        const p = a + b - c;
        v = (v + (Math.abs(p-a) <= Math.abs(p-b) && Math.abs(p-a) <= Math.abs(p-c) ? a : Math.abs(p-b) <= Math.abs(p-c) ? b : c)) & 0xFF;
      }
      pixels[dst + i] = v;
    }
  }
  return { width, height, bpp, pixels };
}

// ── PNG Encoder ──────────────────────────────────────────────────────
function encodePNG(w, h, pixels) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: None
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ── Analyze grid ─────────────────────────────────────────────────────
const img = decodePNG('cat 16x16 with text.png');
console.log(`Source: ${img.width}x${img.height}, bpp=${img.bpp}`);

function getPixel(x, y) {
  const i = (y * img.width + x) * img.bpp;
  return {
    r: img.pixels[i], g: img.pixels[i+1], b: img.pixels[i+2],
    a: img.bpp === 4 ? img.pixels[i+3] : 255
  };
}

// Scan each 32px row to find where sprites start (first non-label pixel column with sprite data)
// We look for the first column where we find dark/sprite-colored pixels consistently
const ROW_H = 32;
const ROWS = Math.floor(img.height / ROW_H);

// Find sprite start X by scanning the first WALK row (row 4, should have clear sprite data)
// Scan multiple rows to find consistent sprite start
let spriteStartX = img.width;
for (let row = 4; row < 12; row++) {
  const y = row * ROW_H + 8; // middle of sprite area
  for (let x = 60; x < img.width; x++) {
    const p = getPixel(x, y);
    // Look for dark pixels (sprite outline) that aren't text
    if (p.a > 128 && p.r < 100 && p.g < 100 && p.b < 100) {
      if (x < spriteStartX) spriteStartX = x;
      break;
    }
  }
}

// Align to 16px grid
spriteStartX = Math.floor(spriteStartX / 16) * 16;
console.log(`Sprites start at x=${spriteStartX}`);

// Calculate max frames per row
const maxFrames = Math.floor((img.width - spriteStartX) / 16);
console.log(`Max frames per row: ${maxFrames}`);

// For each row, count actual frames (non-empty 16x16 cells)
function countFrames(row) {
  let count = 0;
  for (let f = 0; f < maxFrames; f++) {
    const fx = spriteStartX + f * 16;
    const fy = row * ROW_H;
    let hasPixels = false;
    for (let py = fy; py < fy + 16 && !hasPixels; py++) {
      for (let px = fx; px < fx + 16 && !hasPixels; px++) {
        const p = getPixel(px, py);
        if (p.a > 50) hasPixels = true;
      }
    }
    if (hasPixels) count = f + 1; // extend to include this frame
    else if (f > 0 && !hasPixels) break; // stop at first empty after sprites started
  }
  return count;
}

// ── Define animations to extract ─────────────────────────────────────
// Row indices (0-based, each row = 32px)
const ANIMS = {
  // REST section (rows 0-3)
  'rest':        { row: 0 },
  'rest2':       { row: 1 },
  // WALK section (rows 4-11)
  'walk-down':   { row: 4 },
  'walk-up':     { row: 5 },
  'walk-right':  { row: 6 },
  'walk-left':   { row: 7 },
  // SLEEP section (rows 12-19)
  'sleep':       { row: 12 },
  // MEOW section (rows 28-31)
  'meow-sit':    { row: 28 },
  'meow-stand':  { row: 29 },
  // HISS section
  'hiss':        { row: 40 },
};

// ── Output directory ─────────────────────────────────────────────────
const OUT_DIR = 'extension/sprites';
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [name, anim] of Object.entries(ANIMS)) {
  const row = anim.row;
  const frames = countFrames(row);
  if (frames === 0) {
    console.log(`  ${name}: row ${row} - NO FRAMES FOUND, skipping`);
    continue;
  }

  const outW = frames * 16;
  const outH = 16;
  const outPixels = Buffer.alloc(outW * outH * 4, 0); // transparent

  for (let f = 0; f < frames; f++) {
    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const srcX = spriteStartX + f * 16 + px;
        const srcY = row * ROW_H + py;
        const p = getPixel(srcX, srcY);
        const di = (py * outW + f * 16 + px) * 4;
        outPixels[di] = p.r;
        outPixels[di+1] = p.g;
        outPixels[di+2] = p.b;
        outPixels[di+3] = p.a;
      }
    }
  }

  const png = encodePNG(outW, outH, outPixels);
  fs.writeFileSync(`${OUT_DIR}/${name}.png`, png);
  console.log(`  ${name}: ${frames} frames -> ${OUT_DIR}/${name}.png (${outW}x${outH})`);
}

console.log('\nDone! Check sprites/ folder.');
