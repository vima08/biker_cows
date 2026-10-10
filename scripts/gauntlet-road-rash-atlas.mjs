import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const base = process.env.BCFV_URL ?? 'http://127.0.0.1:4186/biker_cows/';
const output = '.gauntlet/road-rash-atlas';
await mkdir(output, { recursive: true });
const source = ts.transpileModule(await readFile('src/roadRash/riderAtlas.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('export function prepareRiderAtlas', 'window.prepareRiderAtlas = function prepareRiderAtlas');
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: source });
  const synthetic = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    for (let row = 0; row < 3; row++) for (let frame = 0; frame < 6; frame++) {
      const x = frame * 256 + 80, bottom = [320, 660, 1000][row];
      ctx.fillStyle = '#302040'; ctx.fillRect(x, bottom - 120, 60, 121);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 20, bottom - 105, 20, 20);
      if (row === 2 && frame === 1) {
        ctx.fillStyle = '#e02060'; ctx.fillRect(x, 670, 10, bottom - 670);
      }
    }
    const image = new Image(); image.src = canvas.toDataURL(); await image.decode();
    const { frames } = window.prepareRiderAtlas(image);
    let whites = 0, weapon = 0, wrongFrameWeapon = 0;
    frames.forEach((row, r) => row.forEach((frame, f) => {
      const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) whites++;
        if (data[i] === 224 && data[i + 1] === 32 && data[i + 2] === 96 && data[i + 3] === 255) {
          if (r === 2 && f === 1) weapon++; else wrongFrameWeapon++;
        }
      }
    }));
    return { whites, weapon, wrongFrameWeapon };
  });
  assert.equal(synthetic.whites, 18 * 400, 'Alpha-authored white details survive unchanged');
  // The arm crosses the source row boundary but fits the normalised frame.
  assert.equal(synthetic.weapon, 3300, 'Cross-row weapon remains complete and attached to its owner');
  assert.equal(synthetic.wrongFrameWeapon, 0, 'Cross-row weapon never leaks into a neighbour');
  const canonical = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 3072; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    for (let row = 0; row < 3; row++) {
      const top = Math.floor(row * 1024 / 3), bottom = Math.floor((row + 1) * 1024 / 3) - 1;
      for (let frame = 0; frame < 6; frame++) {
        ctx.fillStyle = '#fff'; ctx.fillRect(frame * 512 + 256, top, 1, 1);
        ctx.fillStyle = `rgb(${row * 60 + frame + 1},20,30)`;
        ctx.fillRect(frame * 512 + 256, bottom, 1, 1);
      }
    }
    const image = new Image(); image.src = canvas.toDataURL(); await image.decode();
    const { frames } = window.prepareRiderAtlas(image);
    return frames.map((row, r) => row.map((frame, f) => ({
      height: frame.height,
      top: Array.from(frame.getContext('2d').getImageData(256, 0, 1, 1).data),
      bottom: Array.from(frame.getContext('2d').getImageData(256, frame.height - 1, 1, 1).data),
    })));
  });
  for (const [r, row] of canonical.entries()) for (const [f, frame] of row.entries()) {
    assert.equal(frame.height, r === 2 ? 342 : 341);
    assert.deepEqual(frame.top, [255, 255, 255, 255], 'Canonical alpha white pixels bypass all keying');
    assert.deepEqual(frame.bottom, [r * 60 + f + 1, 20, 30, 255], 'Canonical cell slicing preserves pivot and baseline');
  }
  const bossMatte = await page.evaluate(async () => {
    const image = new Image();
    image.src = new URL('assets/road-rash/road-rash-riders-atlas-v3.png', location.href).href;
    await image.decode();
    const { frames } = window.prepareRiderAtlas(image);
    const source = document.createElement('canvas'); source.width = image.naturalWidth; source.height = image.naturalHeight;
    source.getContext('2d').drawImage(image, 0, 0);
    const pixel = (x, y) => Array.from(frames[2][Math.floor(x / 512)].getContext('2d').getImageData(x % 512, y - 682, 1, 1).data);
    return {
      pockets: [[186, 866], [2304, 856], [2885, 850], [2759, 908]].map(([x, y]) => pixel(x, y)[3]),
      highlights: [[250, 755], [303, 755], [1932, 812]].map(([x, y]) => ({
        before: Array.from(source.getContext('2d').getImageData(x, y, 1, 1).data), after: pixel(x, y),
      })),
    };
  });
  assert.deepEqual(bossMatte.pockets, [0, 0, 0, 0], 'Road King enclosed matte pockets become transparent');
  for (const pixel of bossMatte.highlights) assert.deepEqual(pixel.after, pixel.before, 'Road King horns and contact flash retain their white highlights');
  for (const name of ['road-rash-heroines-atlas-v1', 'road-rash-riders-atlas-v3']) {
    const result = await page.evaluate(async name => {
      const image = new Image();
      image.src = new URL(`assets/road-rash/${name}.png`, location.href).href;
      await image.decode();
      const { frames } = window.prepareRiderAtlas(image);
      const duplicate = new Image(); duplicate.src = image.src; await duplicate.decode();
      const reused = window.prepareRiderAtlas(duplicate).frames === frames;
      const contact = document.createElement('canvas'); contact.width = 1536; contact.height = 516;
      const preview = contact.getContext('2d'); preview.fillStyle = '#3c3251'; preview.fillRect(0, 0, 1536, 516);
      const summary = frames.map((row, r) => row.map((canvas, f) => {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let pixels = 0, left = canvas.width, right = -1, top = canvas.height, bottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] < 8) continue;
          pixels++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        preview.drawImage(canvas, f * 256, r * 172, 256, canvas.height / 2);
        return { width: canvas.width, height: canvas.height, pixels, left, right, top, bottom };
      }));
      return { summary, reused, png: contact.toDataURL('image/png').split(',')[1] };
    }, name);
    await writeFile(`${output}/${name}.png`, Buffer.from(result.png, 'base64'));
    assert.equal(result.summary.length, 3);
    assert.equal(result.reused, true, 'New Image instances reuse prepared atlas frames');
    for (const [r, row] of result.summary.entries()) {
      assert.equal(row.length, 6);
      for (const [f, frame] of row.entries()) {
        const label = `${name} row ${r} frame ${f}`;
        assert.equal(frame.width, 512, label);
        assert(frame.height === 341 || frame.height === 342, label);
        assert(frame.pixels > 5000, `${label}: missing silhouette`);
        assert(frame.left > 0 && frame.right < frame.width - 1 && frame.top > 0, `${label}: clipped silhouette ${JSON.stringify(frame)}`);
        assert.equal(frame.bottom, frame.height - 1, `${label}: tyre baseline`);
      }
    }
    console.log(`${name}: 18 complete frames; tyre baselines aligned; no outer-edge clipping`);
    await writeFile(`${output}/${name}.json`, JSON.stringify(result.summary, null, 2));
  }
} finally {
  await browser.close();
}
