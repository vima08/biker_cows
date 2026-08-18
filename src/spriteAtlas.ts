/**
 * Runtime loader and nearest-neighbour renderer for the authored sprite sheets.
 *
 * The module deliberately has no dependency on the rest of the renderer so the
 * procedural art can remain a safe fallback while an image is loading or has
 * failed to load.
 */

export type SpriteSheetId =
  | "cassia"
  | "bruna"
  | "nova"
  | "sustainedFire"
  | "fireRelease"
  | "rider"
  | "riderImpact"
  | "impactMaterial"
  | "bossCore"
  | "bossBody"
  | "roadRipper"
  | "aerials"
  | "enemyRoster";

export interface DrawSpriteFrameOptions {
  /** Destination size in logical canvas pixels. Defaults to the source cell. */
  width?: number;
  height?: number;
  /** Normalised pivot inside the destination rectangle. Defaults to bottom-centre. */
  anchorX?: number;
  anchorY?: number;
  /** Mirror the frame around its anchor without changing its world position. */
  flipX?: boolean;
  /** Opacity, clamped to the 0..1 range. */
  alpha?: number;
}

export type SpriteSheetLoadState = "idle" | "loading" | "ready" | "error";

export interface SpriteSheetStatus {
  readonly id: SpriteSheetId;
  readonly path: string;
  readonly columns: number;
  readonly rows: number;
  readonly frames: number;
  readonly state: SpriteSheetLoadState;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

const SHEET_ORDER = [
  "cassia",
  "bruna",
  "nova",
  "sustainedFire",
  "fireRelease",
  "rider",
  "riderImpact",
  "impactMaterial",
  "bossCore",
  "bossBody",
  "roadRipper",
  "aerials",
  "enemyRoster",
] as const satisfies readonly SpriteSheetId[];

const SHEET_DEFINITIONS: Readonly<Record<SpriteSheetId, {
  readonly path: string;
  readonly columns: number;
  readonly rows: number;
  readonly frames: number;
}>> = Object.freeze({
  cassia: Object.freeze({
    path: "/assets/sprites/cassia-sheet.png",
    columns: 4,
    rows: 2,
    frames: 8,
  }),
  bruna: Object.freeze({
    path: "/assets/sprites/bruna-sheet.png",
    columns: 4,
    rows: 2,
    frames: 8,
  }),
  nova: Object.freeze({
    path: "/assets/sprites/nova-sheet.png",
    columns: 4,
    rows: 2,
    frames: 8,
  }),
  sustainedFire: Object.freeze({
    path: "/assets/sprites/cow-sustained-fire-sheet.png",
    columns: 4,
    rows: 3,
    frames: 12,
  }),
  fireRelease: Object.freeze({
    path: "/assets/sprites/cow-fire-release-sheet.png",
    columns: 3,
    rows: 3,
    frames: 9,
  }),
  rider: Object.freeze({
    path: "/assets/sprites/rider-sheet.png",
    columns: 3,
    rows: 2,
    frames: 6,
  }),
  riderImpact: Object.freeze({
    path: "/assets/sprites/rider-impact-sheet.png",
    columns: 4,
    rows: 3,
    frames: 12,
  }),
  impactMaterial: Object.freeze({
    path: "/assets/sprites/impact-material-sheet.png",
    columns: 4,
    rows: 2,
    frames: 8,
  }),
  bossCore: Object.freeze({
    path: "/assets/sprites/boss-core-sheet.png",
    columns: 3,
    rows: 2,
    frames: 6,
  }),
  bossBody: Object.freeze({
    path: "/assets/sprites/boss-body-sheet.png",
    columns: 3,
    rows: 2,
    frames: 6,
  }),
  roadRipper: Object.freeze({
    path: "/assets/sprites/road-ripper-sheet.png",
    columns: 3,
    rows: 2,
    frames: 6,
  }),
  aerials: Object.freeze({
    path: "/assets/sprites/aerials-sheet.png",
    columns: 4,
    rows: 2,
    frames: 8,
  }),
  enemyRoster: Object.freeze({
    path: "/assets/sprites/enemy-roster-sheet.png",
    columns: 4,
    rows: 3,
    frames: 12,
  }),
});

interface RuntimeSheet {
  image: HTMLImageElement | null;
  state: SpriteSheetLoadState;
  frameWidth: number;
  frameHeight: number;
  promise: Promise<void> | null;
}

const runtime: Record<SpriteSheetId, RuntimeSheet> = {
  cassia: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  bruna: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  nova: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  sustainedFire: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  fireRelease: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  rider: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  riderImpact: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  impactMaterial: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  bossCore: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  bossBody: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  roadRipper: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  aerials: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
  enemyRoster: { image: null, state: "idle", frameWidth: 0, frameHeight: 0, promise: null },
};

function loadSpriteSheet(id: SpriteSheetId): Promise<void> {
  const entry = runtime[id];
  if (entry.state === "ready" || entry.state === "error") return Promise.resolve();
  if (entry.promise) return entry.promise;

  entry.state = "loading";
  entry.promise = new Promise<void>((resolve) => {
    if (typeof Image === "undefined") {
      entry.state = "error";
      resolve();
      return;
    }

    const definition = SHEET_DEFINITIONS[id];
    const image = new Image();
    entry.image = image;
    let objectUrl: string | null = null;

    const releaseObjectUrl = () => {
      if (objectUrl && typeof URL !== "undefined") URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };

    const fail = () => {
      releaseObjectUrl();
      entry.image = null;
      entry.state = "error";
      resolve();
    };

    image.addEventListener("load", () => {
      releaseObjectUrl();
      const frameWidth = Math.floor(image.naturalWidth / definition.columns);
      const frameHeight = Math.floor(image.naturalHeight / definition.rows);
      const dimensionsAreValid = frameWidth > 0 && frameHeight > 0
        && frameWidth * definition.columns === image.naturalWidth
        && frameHeight * definition.rows === image.naturalHeight;

      if (dimensionsAreValid) {
        entry.frameWidth = frameWidth;
        entry.frameHeight = frameHeight;
        entry.state = "ready";
      } else {
        entry.image = null;
        entry.state = "error";
      }
      resolve();
    }, { once: true });

    image.addEventListener("error", fail, { once: true });

    image.decoding = "async";

    // Fetching first avoids the browser's noisy "Failed to load resource" console
    // message for optional atlases while still leaving their status observable.
    if (typeof fetch !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      void fetch(definition.path).then(async (response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!response.ok || !contentType.startsWith("image/")) {
          fail();
          return;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        image.src = objectUrl;
      }).catch(fail);
    } else {
      image.src = definition.path;
    }
  });

  return entry.promise;
}

/**
 * Begin loading every atlas. Missing or malformed sheets are recorded as an
 * error and resolve normally so callers can immediately use procedural art.
 */
export async function preloadSpriteSheets(): Promise<void> {
  await Promise.all(SHEET_ORDER.map(loadSpriteSheet));
}

export function isSpriteSheetReady(id: SpriteSheetId): boolean {
  return runtime[id].state === "ready";
}

/** Return a detached status snapshot; mutating it cannot alter loader state. */
export function getSpriteSheetStatus(): Readonly<Record<SpriteSheetId, SpriteSheetStatus>> {
  return Object.freeze(Object.fromEntries(SHEET_ORDER.map((id) => {
    const definition = SHEET_DEFINITIONS[id];
    const entry = runtime[id];
    return [id, Object.freeze({
      id,
      path: definition.path,
      columns: definition.columns,
      rows: definition.rows,
      frames: definition.frames,
      state: entry.state,
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
    })];
  }))) as Readonly<Record<SpriteSheetId, SpriteSheetStatus>>;
}

/**
 * Draw one atlas cell. `x` and `y` locate the normalised anchor (0..1), not the
 * top-left corner. Returns false without drawing whenever the atlas is not ready.
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  id: SpriteSheetId,
  frame: number,
  x: number,
  y: number,
  options: DrawSpriteFrameOptions = {},
): boolean {
  const entry = runtime[id];
  const image = entry.image;
  if (entry.state !== "ready" || !image || entry.frameWidth <= 0 || entry.frameHeight <= 0) {
    return false;
  }

  const definition = SHEET_DEFINITIONS[id];
  const finiteFrame = Number.isFinite(frame) ? Math.floor(frame) : 0;
  const frameIndex = ((finiteFrame % definition.frames) + definition.frames) % definition.frames;
  const column = frameIndex % definition.columns;
  const row = Math.floor(frameIndex / definition.columns);

  const requestedWidth = options.width ?? entry.frameWidth;
  const requestedHeight = options.height ?? entry.frameHeight;
  const width = Math.max(1, Math.round(Number.isFinite(requestedWidth) ? Math.abs(requestedWidth) : entry.frameWidth));
  const height = Math.max(1, Math.round(Number.isFinite(requestedHeight) ? Math.abs(requestedHeight) : entry.frameHeight));
  const anchorX = Number.isFinite(options.anchorX) ? options.anchorX! : .5;
  const anchorY = Number.isFinite(options.anchorY) ? options.anchorY! : 1;
  const alpha = Math.max(0, Math.min(1, Number.isFinite(options.alpha) ? options.alpha! : 1));
  const worldX = Math.round(Number.isFinite(x) ? x : 0);
  const worldY = Math.round(Number.isFinite(y) ? y : 0);

  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= alpha;
    ctx.translate(worldX, worldY);
    if (options.flipX) ctx.scale(-1, 1);
    const destinationX = Math.round(-width * anchorX);
    const destinationY = Math.round(-height * anchorY);
    ctx.drawImage(
      image,
      column * entry.frameWidth,
      row * entry.frameHeight,
      entry.frameWidth,
      entry.frameHeight,
      destinationX,
      destinationY,
      width,
      height,
    );
  } catch {
    return false;
  } finally {
    ctx.restore();
  }

  return true;
}
