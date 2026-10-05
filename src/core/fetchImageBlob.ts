/** Read critical images while reporting activity, so slow downloads do not time out. */
export async function fetchImageBlob(path: string, signal: AbortSignal, onActivity: () => void): Promise<Blob> {
  const response = await fetch(path, { signal, priority: 'high' } as RequestInit);
  const type = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.ok || !type.startsWith('image/')) throw new Error('Image download failed');
  onActivity();
  if (!response.body) return response.blob();
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value.slice().buffer as ArrayBuffer);
      onActivity();
    }
  } finally { reader.releaseLock(); }
  return new Blob(chunks, { type });
}
