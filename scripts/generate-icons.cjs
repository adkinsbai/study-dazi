// Minimal PNG generator — no external dependencies
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcInput = Buffer.concat([typeB, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function generateIcon(size) {
  // Create raw pixel data (RGBA)
  const raw = Buffer.alloc(size * size * 4);

  // Purple gradient background + white "D" letter
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2);
      const r = Math.round(99 + t * 40);
      const g = Math.round(102 - t * 20);
      const b = Math.round(241 - t * 30);
      const idx = (y * size + x) * 4;

      // Rounded corners
      const cx = size / 2, cy = size / 2, cr = size * 0.43;
      const dx = Math.max(Math.abs(x - cx) - (size / 2 - size * 0.15), 0);
      const dy = Math.max(Math.abs(y - cy) - (size / 2 - size * 0.15), 0);
      const corner = Math.sqrt(dx * dx + dy * dy) > size * 0.15;

      if (corner) {
        raw[idx] = 0; raw[idx+1] = 0; raw[idx+2] = 0; raw[idx+3] = 0;
      } else {
        // "D" letter area (simplified)
        const lx = (x - size * 0.25) / (size * 0.5);
        const ly = (y - size * 0.3) / (size * 0.4);
        const isLetter = lx > 0.0 && lx < 0.7 && ly > 0.0 && ly < 1.0 &&
          !(lx > 0.5 && (ly < 0.18 || ly > 0.82));

        if (isLetter) {
          raw[idx] = 255; raw[idx+1] = 255; raw[idx+2] = 255; raw[idx+3] = 255;
        } else {
          raw[idx] = r; raw[idx+1] = g; raw[idx+2] = b; raw[idx+3] = 255;
        }
      }
    }
  }

  // Filtered row data (row filter byte 0 + pixel data per row)
  const filtered = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    filtered[y * (1 + size * 4)] = 0; // filter: None
    raw.copy(filtered, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = zlib.deflateSync(filtered);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateIcon(512));
console.log('✅ PWA icons generated: icon-192.png, icon-512.png');
