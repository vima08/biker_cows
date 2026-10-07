/** Authored sprites can cross the nominal grid: isolate complete silhouettes first. */
export interface RiderAtlas {
  frames: HTMLCanvasElement[][];
}

// Campaign retries construct fresh Image objects for the same immutable assets.
// Share their prepared frames instead of repeating synchronous pixel analysis.
const preparedAtlases = new Map<string, RiderAtlas>();

export function prepareRiderAtlas(image: HTMLImageElement): RiderAtlas {
  const cacheKey = `${image.currentSrc || image.src}|${image.naturalWidth}x${image.naturalHeight}`;
  const cached = preparedAtlases.get(cacheKey);
  if (cached) return cached;
  // Canonical sheets are baked with genuine alpha, complete 512px-wide frames,
  // and a tyre pivot at x=256. Their white details must never pass through a key.
  if (image.naturalWidth === 3072 && image.naturalHeight === 1024) {
    const frames = Array.from({ length: 3 }, (_, row) => {
      const top = Math.floor(row * 1024 / 3);
      const height = Math.floor((row + 1) * 1024 / 3) - top;
      return Array.from({ length: 6 }, (_, column) => {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = height;
        canvas.getContext('2d')!.drawImage(image, column * 512, top, 512, height, 0, 0, 512, height);
        return canvas;
      });
    });
    const result = { frames };
    preparedAtlases.set(cacheKey, result);
    return result;
  }
  const source = document.createElement('canvas');
  source.width = image.naturalWidth; source.height = image.naturalHeight;
  const context = source.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const frames: HTMLCanvasElement[][] = [];
  for (let row = 0; row < 3; row++) {
    const top = Math.floor(row * source.height / 3);
    const height = Math.floor((row + 1) * source.height / 3) - top;
    const width = source.width;
    const pixels = context.getImageData(0, top, width, height);
    const data = pixels.data;
    const count = width * height;
    const queue = new Int32Array(count);
    let transparent = 0;
    for (let i = 0; i < count; i++) if (data[i * 4 + 3] === 0) transparent++;
    // Alpha-authored rows already have a matte. Never key their white hair/horns.
    if (transparent < count * .2) {
      let head = 0, tail = 0;
      const push = (i: number) => {
        const p = i * 4, r = data[p], g = data[p + 1], b = data[p + 2];
        if (!data[p + 3] || Math.min(r, g, b) <= 188 || Math.max(r, g, b) - Math.min(r, g, b) >= 22) return;
        data[p + 3] = 0; queue[tail++] = i;
      };
      for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
      for (let y = 1; y < height - 1; y++) { push(y * width); push(y * width + width - 1); }
      while (head < tail) {
        const i = queue[head++], x = i % width;
        if (x) push(i - 1); if (x < width - 1) push(i + 1);
        if (i >= width) push(i - width); if (i < count - width) push(i + width);
      }
      // One authored chain loop encloses the legacy checkerboard. This seed is
      // inside the confirmed empty pocket, and uses the same conservative flood
      // as the perimeter. Alpha-authored rows never enter this branch.
      if (image.src.includes('road-rash-riders-atlas-v3')) {
        const seedX = Math.round(1085 * width / 1536);
        const seedY = Math.round(775 * source.height / 1024) - top;
        if (seedY >= 0 && seedY < height) {
          push(seedY * width + seedX);
          while (head < tail) {
            const i = queue[head++], x = i % width;
            if (x) push(i - 1); if (x < width - 1) push(i + 1);
            if (i >= width) push(i - width); if (i < count - width) push(i + width);
          }
        }
      }
    }
    context.putImageData(pixels, 0, top);
  }
  // Segment the complete image. Raised weapons can cross a nominal row edge,
  // just as extended weapons cross a column edge.
  const width = source.width, height = source.height, count = width * height;
  const data = context.getImageData(0, 0, width, height).data;
  const queue = new Int32Array(count);
  const labels = new Int32Array(count);
  const components: Array<{ id: number; size: number; left: number; right: number; top: number; bottom: number }> = [];
  for (let start = 0; start < count; start++) {
    if (labels[start] || data[start * 4 + 3] < 8) continue;
    const id = components.length + 1;
    const component = { id, size: 0, left: width, right: 0, top: height, bottom: 0 };
    let head = 0, tail = 1; queue[0] = start; labels[start] = id;
    const push = (i: number) => {
      if (!labels[i] && data[i * 4 + 3] >= 8) { labels[i] = id; queue[tail++] = i; }
    };
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width);
      component.size++; component.left = Math.min(component.left, x); component.right = Math.max(component.right, x);
      component.top = Math.min(component.top, y); component.bottom = Math.max(component.bottom, y);
      if (x) push(i - 1); if (x < width - 1) push(i + 1);
      if (i >= width) push(i - width); if (i < count - width) push(i + width);
    }
    components.push(component);
  }
  const sprites = components.filter(c => c.size > 300).sort((a, b) => b.size - a.size).slice(0, 18).sort((a, b) => a.bottom - b.bottom);
  if (sprites.length !== 18) throw new Error(`Road Rash atlas: expected eighteen silhouettes, found ${sprites.length}`);
  const owners = new Int32Array(components.length + 1).fill(-1);
  sprites.forEach((sprite, frame) => { owners[sprite.id] = frame; });
  // Keep detached highlights and sparks with the nearest complete silhouette.
  for (const c of components) {
    if (owners[c.id] >= 0) continue;
    let best = Number.POSITIVE_INFINITY, owner = -1;
    sprites.forEach((s, frame) => {
      const dx = Math.max(0, s.left - c.right, c.left - s.right);
      const dy = Math.max(0, s.top - c.bottom, c.top - s.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance < best) { best = distance; owner = frame; }
    });
    owners[c.id] = owner;
  }
  const isolated = sprites.map((sprite, frame) => {
    const row = Math.floor(frame / 6);
    const frameHeight = Math.floor((row + 1) * height / 3) - Math.floor(row * height / 3);
    // Rear tyre contact, rather than the bounding box centre, stays stationary
    // as an arm or weapon extends outside the nominal cell.
    let sumX = 0, wheelPixels = 0;
    for (let y = Math.max(sprite.top, sprite.bottom - 10); y <= sprite.bottom; y++) {
      for (let x = sprite.left; x <= sprite.right; x++) {
        if (labels[y * width + x] === sprite.id) { sumX += x; wheelPixels++; }
      }
    }
    const pivotX = Math.round(sumX / wheelPixels);
    const canvas = document.createElement('canvas'); canvas.width = Math.round(width / 3); canvas.height = frameHeight;
    const target = canvas.getContext('2d')!;
    const output = target.createImageData(canvas.width, frameHeight);
    for (const c of components) {
      if (owners[c.id] !== frame) continue;
      for (let y = c.top; y <= c.bottom; y++) for (let x = c.left; x <= c.right; x++) {
        const i = y * width + x;
        if (labels[i] !== c.id) continue;
        const dx = x - pivotX + canvas.width / 2, dy = y - sprite.bottom + frameHeight - 1;
        if (dx < 0 || dx >= canvas.width || dy < 0 || dy >= frameHeight) continue;
        const from = i * 4, to = (dy * canvas.width + dx) * 4;
        output.data[to] = data[from]; output.data[to + 1] = data[from + 1];
        output.data[to + 2] = data[from + 2]; output.data[to + 3] = data[from + 3];
      }
    }
    target.putImageData(output, 0, 0);
    return canvas;
  });
  for (let row = 0; row < 3; row++) {
    frames[row] = sprites.slice(row * 6, (row + 1) * 6)
      .map((sprite, offset) => ({ sprite, canvas: isolated[row * 6 + offset] }))
      .sort((a, b) => a.sprite.left - b.sprite.left)
      .map(item => item.canvas);
  }
  const result = { frames };
  preparedAtlases.set(cacheKey, result);
  return result;
}
