// Render the project's vector leaf into native extension PNG icons.
// Uses only Node's standard library; no install or build step is required.
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), body = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const len = Buffer.alloc(4), end = Buffer.alloc(4);
  len.writeUInt32BE(data.length); end.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, end]);
}
function bezier(a, b, c, d, t) { return (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d; }
function curve(a, b, c, d) {
  return Array.from({ length: 41 }, (_, i) => [bezier(a[0], b[0], c[0], d[0], i / 40), bezier(a[1], b[1], c[1], d[1], i / 40)]);
}
const leaf = [...curve([11, 25], [9, 13], [20, 10], [30, 10]), ...curve([30, 10], [30, 22], [24, 30], [16, 28])];
const stem = curve([11, 30], [13, 23], [18, 18], [25, 14]);
const veins = [[[16, 23], [15, 17]], [[20, 20], [26, 21]], ...stem.slice(1).map((p, i) => [stem[i], p])];
function inside(x, y, points) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [a, b] = points[i], [c, d] = points[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) result = !result;
  }
  return result;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
for (const size of [16, 48, 128]) {
  const data = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const color = [0, 0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = (x + (sx + .5) / 4) / size * 40, py = (y + (sy + .5) / 4) / size * 40;
      const cornerX = Math.max(13 - px, px - 27, 0), cornerY = Math.max(13 - py, py - 27, 0);
      if (cornerX * cornerX + cornerY * cornerY > 169) continue;
      const green = inside(px, py, leaf) && !veins.some(([a, b]) => segmentDistance(px, py, a, b) < .85);
      const sample = green ? [83, 121, 78, 255] : [217, 232, 204, 255];
      sample.forEach((n, i) => { color[i] += n / 16; });
    }
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    color.forEach((n, i) => { data[offset + i] = Math.round(n); });
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(new URL(`../assets/icon-${size}.png`, import.meta.url), png);
}
