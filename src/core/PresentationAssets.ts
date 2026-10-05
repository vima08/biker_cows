import { assetUrl } from '../assetUrl';
import { INTRO_PANELS, OUTRO_PANELS } from '../rider/catalog';
import { getSelectPortraitsStatus, preloadSelectPortraits } from '../selectPortraits';
import { isArtEnabled } from '../debug/runtime';
import { fetchImageBlob } from './fetchImageBlob';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
export type PresentationScene = 'title' | 'select' | 'intro' | 'outro';

/** Critical artwork is ready only after image decoding has finished. */
class PresentationImage {
  image = new Image();
  state: LoadState = 'idle';

  constructor(readonly path: string, readonly label: string) {}

  load(retry = false): void {
    if (this.state !== 'idle' && !(retry && this.state === 'error')) return;
    this.state = 'loading';
    const image = this.image = new Image();
    image.dataset.assetPath = this.path;
    image.decoding = 'async';
    image.fetchPriority = 'high';
    let settled = false;
    let objectUrl: string | null = null;
    let timeout = 0;
    const controller = new AbortController();
    const finish = (state: 'ready' | 'error') => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      this.state = state;
      image.onload = image.onerror = null;
      if (state === 'error') image.removeAttribute('src');
    };
    const activity = () => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => { finish('error'); controller.abort(); }, 120_000);
    };
    activity();
    image.onerror = () => finish('error');
    image.onload = async () => {
      try {
        await image.decode();
        finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? 'ready' : 'error');
      } catch { finish('error'); }
    };
    void fetchImageBlob(this.path, controller.signal, activity).then(blob => {
      if (settled) return;
      objectUrl = URL.createObjectURL(blob);
      image.src = objectUrl;
    }).catch(() => finish('error'));
  }
}

export interface PresentationLoadingStatus {
  scene: PresentationScene;
  ready: number;
  total: number;
  failed: number;
  percent: number;
  assets: Array<{ label: string; state: LoadState }>;
}

export class PresentationAssets {
  readonly title = new PresentationImage(assetUrl('assets/venus-title-key-art.png'), 'Cover');
  readonly intro = INTRO_PANELS.map((panel, index) => new PresentationImage(panel.src, `Intro ${index + 1}`));
  readonly outro = OUTRO_PANELS.map((panel, index) => new PresentationImage(panel.src, `Finale ${index + 1}`));
  private readonly bypassed = new Set<PresentationScene>();

  private images(scene: PresentationScene): PresentationImage[] {
    return scene === 'title' ? [this.title] : scene === 'intro' ? this.intro : scene === 'outro' ? this.outro : [];
  }

  prepare(scene: string, retry = false): void {
    if (!isArtEnabled() || !this.isScene(scene) || this.bypassed.has(scene)) return;
    if (scene === 'select') void preloadSelectPortraits(retry);
    else for (const image of this.images(scene)) image.load(retry);
  }

  private isScene(scene: string): scene is PresentationScene {
    return scene === 'title' || scene === 'select' || scene === 'intro' || scene === 'outro';
  }

  status(scene: string): PresentationLoadingStatus | null {
    if (!isArtEnabled() || !this.isScene(scene) || this.bypassed.has(scene)) return null;
    const assets = scene === 'select'
      ? [{ label: 'Rider portraits', state: getSelectPortraitsStatus().state }]
      : this.images(scene).map(image => ({ label: image.label, state: image.state }));
    const ready = assets.filter(asset => asset.state === 'ready').length;
    if (ready === assets.length) return null;
    return { scene, ready, total: assets.length, failed: assets.filter(asset => asset.state === 'error').length,
      percent: Math.floor(ready / assets.length * 100), assets };
  }

  /** A fallback is an explicit player choice, available only after a real error. */
  continueWithoutImages(scene: PresentationScene): void {
    if (this.status(scene)?.failed) this.bypassed.add(scene);
  }

  warmNext(scene: string): void {
    if (this.status(scene)) return;
    if (scene === 'title') this.prepare('select');
    if (scene === 'select') this.prepare('intro');
  }
}
