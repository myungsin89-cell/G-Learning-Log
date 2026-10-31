import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outputDir = path.join(publicDir, 'brand', 'generated');
const source = await readFile(path.join(publicDir, 'seulgirok-favicon.svg'));

await mkdir(outputDir, { recursive: true });

for (const size of [512, 256, 180, 128, 64, 48, 32, 16]) {
  const output = size === 180
    ? path.join(publicDir, 'apple-touch-icon.png')
    : path.join(outputDir, `seulgirok-${size}.png`);
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(output);
}

const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map((size) => readFile(path.join(outputDir, `seulgirok-${size}.png`))));
const headerSize = 6 + icoSizes.length * 16;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = headerSize;
pngs.forEach((png, index) => {
  const size = icoSizes[index];
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...pngs]));

for (const name of ['share-preview', 'join-share-preview']) {
  await sharp(path.join(publicDir, `${name}.svg`), { density: 144 }).resize(1200, 630).png().toFile(path.join(publicDir, `${name}.png`));
}

console.log('Generated 슬기록 PNG, ICO, and social preview assets.');
