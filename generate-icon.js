// Generates a simple cat icon PNG (128x128) with no dependencies
// Uses raw PNG encoding with pako-less deflate (uncompressed DEFLATE blocks)

const fs = require('fs');
const zlib = require('zlib');

const W = 128, H = 128;
const pixels = Buffer.alloc(W * H * 4, 0); // RGBA

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx*dx + dy*dy <= radius*radius) setPixel(x, y, r, g, b, a);
    }
  }
}

function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx*dx + dy*dy <= 1) setPixel(x, y, r, g, b, a);
    }
  }
}

function fillTriangle(x1, y1, x2, y2, x3, y3, r, g, b, a = 255) {
  const minX = Math.min(x1, x2, x3), maxX = Math.max(x1, x2, x3);
  const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Barycentric coordinates
      const d = (y2-y3)*(x1-x3) + (x3-x2)*(y1-y3);
      const a1 = ((y2-y3)*(x-x3) + (x3-x2)*(y-y3)) / d;
      const a2 = ((y3-y1)*(x-x3) + (x1-x3)*(y-y3)) / d;
      const a3 = 1 - a1 - a2;
      if (a1 >= 0 && a2 >= 0 && a3 >= 0) setPixel(x, y, r, g, b, a);
    }
  }
}

// ── Draw the cat ──

// Background: transparent (already zeroed)

// Body (orange circle)
fillCircle(64, 72, 42, 244, 164, 96);

// Belly patch
fillEllipse(64, 82, 22, 18, 255, 224, 178);

// Head (overlapping circle, slightly higher)
fillCircle(64, 52, 36, 244, 164, 96);

// Ears (triangles)
fillTriangle(20, 38, 32, 8, 46, 32, 244, 164, 96);  // left
fillTriangle(82, 32, 96, 8, 108, 38, 244, 164, 96);  // right

// Inner ears (pink)
fillTriangle(26, 35, 33, 16, 42, 32, 255, 182, 193); // left
fillTriangle(86, 32, 95, 16, 102, 35, 255, 182, 193); // right

// Eyes (dark)
fillEllipse(48, 48, 6, 7, 51, 51, 51);   // left
fillEllipse(80, 48, 6, 7, 51, 51, 51);   // right

// Eye shine (white dots)
fillCircle(51, 45, 2, 255, 255, 255);  // left
fillCircle(83, 45, 2, 255, 255, 255);  // right

// Nose (pink)
fillEllipse(64, 58, 4, 3, 255, 138, 155);

// Mouth (two small dark arcs - simplified as dots/ellipses)
fillEllipse(58, 63, 4, 2, 100, 80, 70);
fillEllipse(70, 63, 4, 2, 100, 80, 70);
// Cover top half of mouth ellipses with face color to make smile shape
fillEllipse(58, 62, 4, 2, 244, 164, 96);
fillEllipse(70, 62, 4, 2, 244, 164, 96);

// Blush (subtle pink circles)
fillCircle(38, 56, 5, 255, 182, 193, 120);
fillCircle(90, 56, 5, 255, 182, 193, 120);

// Whiskers (horizontal lines)
for (let x = 10; x < 38; x++) { setPixel(x, 56, 150, 130, 110); setPixel(x, 60, 150, 130, 110); }
for (let x = 90; x < 118; x++) { setPixel(x, 56, 150, 130, 110); setPixel(x, 60, 150, 130, 110); }

// Paws (small lighter circles at bottom)
fillCircle(46, 108, 8, 255, 216, 168);
fillCircle(82, 108, 8, 255, 216, 168);

// Stripes on forehead
for (let x = 54; x < 74; x++) { setPixel(x, 28, 210, 137, 27); setPixel(x, 32, 210, 137, 27); }
for (let x = 50; x < 78; x++) { setPixel(x, 30, 210, 137, 27); }

// ── Encode PNG ──
// Build raw image data (filter byte 0 = None for each row)
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter: None
  pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}

const compressed = zlib.deflateSync(raw);

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

// Write multiple sizes
fs.mkdirSync('extension', { recursive: true });
fs.writeFileSync('extension/icon128.png', png);
console.log('Created extension/icon128.png (128x128)');

// Also create 48x48 and 16x16 by simple nearest-neighbor downscale
function downscale(srcW, srcH, srcPixels, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = Math.floor(x * srcW / dstW);
      const sy = Math.floor(y * srcH / dstH);
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = srcPixels[si];
      dst[di+1] = srcPixels[si+1];
      dst[di+2] = srcPixels[si+2];
      dst[di+3] = srcPixels[si+3];
    }
  }
  return dst;
}

function writePNG(filename, w, h, pxls) {
  const rawData = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    rawData[y * (1 + w * 4)] = 0;
    pxls.copy(rawData, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const comp = zlib.deflateSync(rawData);
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4);
  hdr[8] = 8; hdr[9] = 6;
  const out = Buffer.concat([signature, chunk('IHDR', hdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(filename, out);
  console.log(`Created ${filename} (${w}x${h})`);
}

const px48 = downscale(128, 128, pixels, 48, 48);
writePNG('extension/icon48.png', 48, 48, px48);

const px16 = downscale(128, 128, pixels, 16, 16);
writePNG('extension/icon16.png', 16, 16, px16);
