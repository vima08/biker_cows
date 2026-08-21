export type AssetLoadState = 'loading' | 'ready' | 'error';

/** Small observable wrapper used by renderers that support procedural fallbacks. */
export class ImageAsset {
  image: HTMLImageElement | null = null;
  state: AssetLoadState = 'loading';

  constructor(
    readonly path: string,
    readonly columns = 1,
    readonly rows = 1,
  ) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      this.image = image;
      this.state = 'ready';
    };
    image.onerror = () => {
      this.image = null;
      this.state = 'error';
    };
    image.src = path;
  }
}
