export type RenderMode = 'authored' | 'vector';

let artEnabled = true;

export function configureDebugRuntime(search: string): void {
  const query = new URLSearchParams(search);
  artEnabled = query.get('art') !== 'vector';
}

export function setArtEnabled(enabled: boolean): void {
  artEnabled = Boolean(enabled);
}

export function isArtEnabled(): boolean {
  return artEnabled;
}

export function getRenderMode(): RenderMode {
  return artEnabled ? 'authored' : 'vector';
}
