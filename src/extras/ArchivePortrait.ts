import { assetUrl } from '../assetUrl';
import { prepareRiderAtlas } from '../roadRash/riderAtlas';
import type { ArchiveEntry } from './content';

/** Shared by the archive and the in-campaign dossier. */
export function archivePortrait(entry: ArchiveEntry): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'extras-portrait';
  const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 420;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', entry.title);
  const status = document.createElement('figcaption'); figure.append(canvas, status);
  const load = () => {
    status.textContent = 'Загрузка портрета…';
    const image = new Image(), spec = entry.portrait!;
    image.onload = () => {
      try {
        let source: CanvasImageSource = image;
        let sx = spec.frame % spec.columns * image.naturalWidth / spec.columns;
        let sy = Math.floor(spec.frame / spec.columns) * image.naturalHeight / spec.rows;
        let sw = image.naturalWidth / spec.columns, sh = image.naturalHeight / spec.rows;
        if (spec.isolated) {
          const frame = prepareRiderAtlas(image).frames[spec.frame]?.[0]; if (!frame) throw new Error('Missing portrait');
          source = frame; sx = sy = 0; sw = frame.width; sh = frame.height;
        }
        const context = canvas.getContext('2d')!, scale = Math.min(600 / sw, 420 / sh);
        context.clearRect(0, 0, 600, 420);
        context.drawImage(source, sx, sy, sw, sh, (600 - sw * scale) / 2, (420 - sh * scale) / 2, sw * scale, sh * scale);
        status.textContent = entry.title.split(' — ')[0];
      } catch { failed(); }
    };
    const failed = () => {
      status.textContent = 'Портрет не загрузился. ';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить'; retry.onclick = load; status.append(retry);
    };
    image.onerror = failed; image.src = assetUrl(spec.path);
  };
  load(); return figure;
}
