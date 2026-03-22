const fs = require('fs');
const zlib = require('zlib');

// ── PNG Decoder/Encoder (compact) ────────────────────────────────────
function decodePNG(filepath) {
  const buf = fs.readFileSync(filepath);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ct = buf[25];
  let pos = 8; const idats = [];
  while (pos < buf.length) { const l = buf.readUInt32BE(pos); const t = buf.toString('ascii',pos+4,pos+8); if(t==='IDAT')idats.push(buf.slice(pos+8,pos+8+l)); if(t==='IEND')break; pos+=12+l; }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = ct===6?4:3, stride = w*bpp, px = Buffer.alloc(w*h*bpp);
  for (let y=0;y<h;y++){const f=raw[y*(stride+1)],s=y*(stride+1)+1,d=y*stride;for(let i=0;i<stride;i++){let v=raw[s+i];const a=i>=bpp?px[d+i-bpp]:0,b=y>0?px[d-stride+i]:0,c=(i>=bpp&&y>0)?px[d-stride+i-bpp]:0;if(f===1)v=(v+a)&0xFF;else if(f===2)v=(v+b)&0xFF;else if(f===3)v=(v+((a+b)>>1))&0xFF;else if(f===4){const p=a+b-c;v=(v+(Math.abs(p-a)<=Math.abs(p-b)&&Math.abs(p-a)<=Math.abs(p-c)?a:Math.abs(p-b)<=Math.abs(p-c)?b:c))&0xFF;}px[d+i]=v;}}
  return {width:w,height:h,bpp,pixels:px};
}
function encodePNG(w,h,px){
  const raw=Buffer.alloc(h*(1+w*4));for(let y=0;y<h;y++){raw[y*(1+w*4)]=0;px.copy(raw,y*(1+w*4)+1,y*w*4,(y+1)*w*4);}
  const comp=zlib.deflateSync(raw);
  const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++){c^=b[i];for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xEDB88320:0);}return(c^0xFFFFFFFF)>>>0;};
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td));return Buffer.concat([l,td,cr]);};
  const sig=Buffer.from([137,80,78,71,13,10,26,10]),ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([sig,chunk('IHDR',ih),chunk('IDAT',comp),chunk('IEND',Buffer.alloc(0))]);
}

// ── Load ─────────────────────────────────────────────────────────────
const img = decodePNG('cat 16x16 with text.png');
const C = 32;           // cell size (sprites are 32x32)
const X_OFF = 80;       // skip 80px label area on the left (colored block + text)
const COLS = Math.floor((img.width - X_OFF) / C);  // (432-80)/32 = 11
const ROWS = Math.floor(img.height / C);            // 1696/32 = 53
console.log(`Source: ${img.width}x${img.height} → ${COLS}x${ROWS} grid of ${C}x${C} (X offset: ${X_OFF})\n`);

function getPixel(x, y) {
  if(x<0||x>=img.width||y<0||y>=img.height) return {r:0,g:0,b:0,a:0};
  const i=(y*img.width+x)*img.bpp;
  return {r:img.pixels[i],g:img.pixels[i+1],b:img.pixels[i+2],a:img.bpp===4?img.pixels[i+3]:255};
}

// Cell origin in pixel coordinates (accounting for X offset)
function cellX(col) { return X_OFF + col * C; }
function cellY(row) { return row * C; }

function cellAlpha(col, row) {
  let n = 0;
  const ox = cellX(col), oy = cellY(row);
  for (let dy = 0; dy < C; dy++)
    for (let dx = 0; dx < C; dx++)
      if (getPixel(ox + dx, oy + dy).a > 50) n++;
  return n;
}

function isSolidBlock(col, row) {
  let n = 0;
  const ox = cellX(col), oy = cellY(row);
  for (let dy = 0; dy < C; dy++)
    for (let dx = 0; dx < C; dx++) {
      const p = getPixel(ox + dx, oy + dy);
      if (p.a > 200 && (p.r > 80 || p.g > 80 || p.b > 80)) n++;
    }
  return n > 700; // ~70% of 1024 pixels
}

// Find sprite frames: scan right-to-left, find last non-empty, walk back
function findSpriteRange(row) {
  let right = -1;
  for (let c = COLS - 1; c >= 0; c--) {
    if (cellAlpha(c, row) > 30 && !isSolidBlock(c, row)) { right = c; break; }
  }
  if (right === -1) return null;

  let left = right;
  for (let c = right - 1; c >= 0; c--) {
    const a = cellAlpha(c, row);
    if (a <= 30) break;
    if (isSolidBlock(c, row)) break;
    left = c;
  }
  return { start: left, end: right, frames: right - left + 1 };
}

// ── Animation definitions (row index in 32x32 grid) ──────────────────
// Each pair of old 16x16 rows = one 32x32 row
const ANIMS = [
  // REST (32-rows 0-3)
  ['rest-1', 0], ['rest-2', 1], ['rest-3', 2], ['rest-4', 3],
  // WALK (32-rows 4-11)
  ['walk-down', 4], ['walk-up', 5],
  ['walk-right', 6], ['walk-left', 7],
  ['walk-ld', 8], ['walk-rd', 9],
  ['walk-ru', 10], ['walk-lu', 11],
  // SLEEP (32-rows 12-19)
  ['sleep-1', 12], ['sleep-2', 13], ['sleep-3', 14], ['sleep-4', 15],
  ['sleep-5', 16], ['sleep-6', 17], ['sleep-7', 18], ['sleep-8', 19],
  // EAT (32-rows 20-27)
  ['eat-1', 20], ['eat-2', 21], ['eat-3', 22], ['eat-4', 23],
  ['eat-5', 24], ['eat-6', 25], ['eat-7', 26], ['eat-8', 27],
  // MEOW (32-rows 28-31)
  ['meow-1', 28], ['meow-2', 29], ['meow-3', 30], ['meow-4', 31],
  // YAWN (32-rows 32-35)
  ['yawn-1', 32], ['yawn-2', 33], ['yawn-3', 34], ['yawn-4', 35],
  // WASH (32-rows 36-38)
  ['wash-1', 36], ['wash-2', 37], ['wash-3', 38],
  // ITCH (32-rows 39-40)
  ['itch-1', 39], ['itch-2', 40],
  // HISS (32-rows 41-42)
  ['hiss-1', 41], ['hiss-2', 42],
  // gap row 43
  // PAW ATTACK (32-rows 44-52)
  ['paw-1', 44], ['paw-2', 45], ['paw-3', 46], ['paw-4', 47],
  ['paw-5', 48], ['paw-6', 49], ['paw-7', 50], ['paw-8', 51],
  ['paw-9', 52],
];

// ── Extract ──────────────────────────────────────────────────────────
const OUT = 'extension/sprites';
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(`${OUT}/${f}`);

const results = {};

for (const [name, row] of ANIMS) {
  const range = findSpriteRange(row);
  if (!range || range.frames < 1) continue;

  const { start, end, frames } = range;
  const outW = frames * C, outH = C;
  const px = Buffer.alloc(outW * outH * 4, 0);

  for (let f = 0; f < frames; f++) {
    for (let dy = 0; dy < C; dy++) for (let dx = 0; dx < C; dx++) {
      const p = getPixel(cellX(start + f) + dx, cellY(row) + dy);
      const di = (dy * outW + f * C + dx) * 4;
      px[di] = p.r; px[di+1] = p.g; px[di+2] = p.b; px[di+3] = p.a;
    }
  }

  fs.writeFileSync(`${OUT}/${name}.png`, encodePNG(outW, outH, px));
  results[name] = frames;
  console.log(`  ${name}: row ${row}, cols ${start}-${end} = ${frames} frames`);
}

// ── Pick best per category for the extension ─────────────────────────
const PICKS = {
  'rest':       'rest-1',
  'walk-right': 'walk-right',
  'walk-left':  'walk-left',
  'walk-down':  'walk-down',
  'walk-up':    'walk-up',
  'sleep':      'sleep-1',
  'eat':        'eat-1',
  'meow':       'meow-1',
  'yawn':       'yawn-1',
  'wash':       'wash-1',
  'itch':       'itch-1',
  'hiss':       'hiss-1',
  'paw':        'paw-1',
  'sit':        'rest-3',
};

console.log('\n── Extension sprites (picked best per category) ──');
for (const [alias, src] of Object.entries(PICKS)) {
  if (alias === src) continue; // already extracted with that name
  const srcFile = `${OUT}/${src}.png`;
  const dstFile = `${OUT}/${alias}.png`;
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, dstFile);
    console.log(`  ${alias}.png <- ${src}.png (${results[src]} frames)`);
  }
}

console.log('\nDone!');
