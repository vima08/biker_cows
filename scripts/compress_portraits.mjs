import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const source = new URL('../public/assets/ui/cow-portraits-sheet.png', import.meta.url);
const destination = new URL('../public/assets/ui/cow-portraits-sheet.webp', import.meta.url);
const png = await readFile(source);
const browser = await chromium.launch({
  executablePath: process.env.BCFV_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  const encoded = await page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const original = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const dataUrl = canvas.toDataURL('image/webp', .9);
    if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('WebP encoding unavailable');
    const webp = new Image();
    webp.src = dataUrl;
    await webp.decode();
    if (webp.naturalWidth !== canvas.width || webp.naturalHeight !== canvas.height) {
      throw new Error('Portrait dimensions changed');
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(webp, 0, 0);
    const converted = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < original.length; index += 4) {
      if (original[index] !== converted[index]) throw new Error('Portrait transparency changed');
    }
    return dataUrl.split(',')[1];
  }, png.toString('base64'));
  const webp = Buffer.from(encoded, 'base64');
  await writeFile(destination, webp);
  console.log(`Portraits: ${png.length} -> ${webp.length} bytes; dimensions and alpha preserved`);
} finally {
  await browser.close();
}
