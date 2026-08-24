/**
 * Optional authored portraits for the hero-select screen.
 *
 * The single local PNG is split into three equal cells. Loading failure is a
 * normal state: callers receive `false` from drawHeroPortrait and can retain
 * the existing procedural portrait without delaying the menu.
 */

import { assetUrl } from './assetUrl';
import { isArtEnabled } from './debug/runtime';

export type SelectPortraitHeroId = "cassia" | "bruna" | "nova";
export type SelectPortraitLoadState = "idle" | "loading" | "ready" | "error";

export interface DrawHeroPortraitOptions {
  /** Multiplies the current canvas alpha. */
  alpha?: number;
  /** Adds a hard-pixel selection bracket around the destination bounds. */
  selected?: boolean;
  /** Selection-light strength in the 0..1 range; animation remains caller-owned. */
  pulse?: number;
  /** Pixel-bracket colour. */
  edgeColor?: string;
}

export interface SelectPortraitsStatus {
  readonly path: string;
  readonly columns: 3;
  readonly rows: 1;
  readonly state: SelectPortraitLoadState;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

interface PortraitLayout {
  readonly column: number;
  /** Fixed normalised crop within one atlas cell. */
  readonly crop: readonly [x: number, y: number, width: number, height: number];
  /** Fixed normalised destination pivot. `x`,`y` locate this point. */
  readonly pivot: readonly [x: number, y: number];
}

const SHEET_PATH = assetUrl("assets/ui/cow-portraits-sheet.png");
const COLUMNS = 3;
const ROWS = 1;

// The image-generation contract keeps every bust inside its transparent cell.
// Keeping these values authored (rather than scanning alpha at runtime) makes
// menu composition deterministic across browsers and future asset revisions.
const PORTRAIT_LAYOUTS = Object.freeze({
  cassia: Object.freeze({ column: 0, crop: [0, 0, 1, 1] as const, pivot: [.5, .94] as const }),
  bruna: Object.freeze({ column: 1, crop: [0, 0, 1, 1] as const, pivot: [.5, .94] as const }),
  nova: Object.freeze({ column: 2, crop: [0, 0, 1, 1] as const, pivot: [.5, .94] as const }),
} satisfies Record<SelectPortraitHeroId, PortraitLayout>);

let image: HTMLImageElement | null = null;
let state: SelectPortraitLoadState = "idle";
let cellWidth = 0;
let cellHeight = 0;
let loadPromise: Promise<void> | null = null;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function beginLoad(): Promise<void> {
  if (state === "ready" || state === "error") return Promise.resolve();
  if (loadPromise) return loadPromise;

  state = "loading";
  loadPromise = new Promise<void>((resolve) => {
    if (typeof Image === "undefined") {
      state = "error";
      resolve();
      return;
    }

    const nextImage = new Image();
    image = nextImage;
    let objectUrl: string | null = null;
    let settled = false;

    const releaseObjectUrl = () => {
      if (objectUrl && typeof URL !== "undefined") URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };
    const settle = (nextState: SelectPortraitLoadState) => {
      if (settled) return;
      settled = true;
      releaseObjectUrl();
      state = nextState;
      if (nextState === "error") image = null;
      resolve();
    };

    nextImage.addEventListener("load", () => {
      const width = Math.floor(nextImage.naturalWidth / COLUMNS);
      const height = Math.floor(nextImage.naturalHeight / ROWS);
      const valid = width > 0 && height > 0 &&
        width * COLUMNS === nextImage.naturalWidth && height * ROWS === nextImage.naturalHeight;
      if (!valid) {
        settle("error");
        return;
      }
      cellWidth = width;
      cellHeight = height;
      settle("ready");
    }, { once: true });
    nextImage.addEventListener("error", () => settle("error"), { once: true });
    nextImage.decoding = "async";

    // Fetch first so an optional missing sheet resolves to the procedural
    // fallback without a noisy image-resource error in the browser console.
    if (typeof fetch !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      void fetch(SHEET_PATH).then(async (response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!response.ok || !contentType.startsWith("image/")) {
          settle("error");
          return;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        nextImage.src = objectUrl;
      }).catch(() => settle("error"));
    } else {
      nextImage.src = SHEET_PATH;
    }
  });

  return loadPromise;
}

/** Begin loading the optional local portrait atlas. This promise never rejects. */
export async function preloadSelectPortraits(): Promise<void> {
  await beginLoad();
}

export function isSelectPortraitsReady(): boolean {
  return state === "ready";
}

/** Return a detached immutable loader snapshot. */
export function getSelectPortraitsStatus(): Readonly<SelectPortraitsStatus> {
  return Object.freeze({
    path: SHEET_PATH,
    columns: COLUMNS,
    rows: ROWS,
    state,
    cellWidth,
    cellHeight,
  });
}

function drawSelectedEdge(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  color: string,
  pulse: number,
): void {
  const thickness = 2;
  const corner = Math.max(10, Math.min(24, Math.round(Math.min(width, height) * .1)));
  ctx.globalAlpha *= .42 + clamp01(pulse) * .48;
  ctx.fillStyle = color;
  ctx.fillRect(left, top, corner, thickness);
  ctx.fillRect(left, top, thickness, corner);
  ctx.fillRect(left + width - corner, top, corner, thickness);
  ctx.fillRect(left + width - thickness, top, thickness, corner);
  ctx.fillRect(left, top + height - thickness, corner, thickness);
  ctx.fillRect(left, top + height - corner, thickness, corner);
  ctx.fillRect(left + width - corner, top + height - thickness, corner, thickness);
  ctx.fillRect(left + width - thickness, top + height - corner, thickness, corner);
}

/**
 * Draw one portrait with nearest-neighbour sampling.
 *
 * `x`,`y` specify the portrait's fixed lower-centre pivot, rather than its
 * top-left corner. Returns false without drawing when the optional sheet is not
 * ready, malformed, or the hero id is unknown at runtime.
 */
export function drawHeroPortrait(
  ctx: CanvasRenderingContext2D,
  heroId: SelectPortraitHeroId,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DrawHeroPortraitOptions = {},
): boolean {
  if (!isArtEnabled()) return false;
  const sourceImage = image;
  const layout: PortraitLayout | undefined = PORTRAIT_LAYOUTS[heroId];
  if (state !== "ready" || !sourceImage || !layout || cellWidth <= 0 || cellHeight <= 0) return false;

  const destinationWidth = Math.max(1, Math.round(Number.isFinite(width) ? Math.abs(width) : cellWidth));
  const destinationHeight = Math.max(1, Math.round(Number.isFinite(height) ? Math.abs(height) : cellHeight));
  const worldX = Math.round(Number.isFinite(x) ? x : 0);
  const worldY = Math.round(Number.isFinite(y) ? y : 0);
  const left = Math.round(worldX - destinationWidth * layout.pivot[0]);
  const top = Math.round(worldY - destinationHeight * layout.pivot[1]);
  const alpha = clamp01(Number.isFinite(options.alpha) ? options.alpha! : 1);
  const [cropX, cropY, cropWidth, cropHeight] = layout.crop;

  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= alpha;
    ctx.drawImage(
      sourceImage,
      Math.round(layout.column * cellWidth + cropX * cellWidth),
      Math.round(cropY * cellHeight),
      Math.max(1, Math.round(cropWidth * cellWidth)),
      Math.max(1, Math.round(cropHeight * cellHeight)),
      left,
      top,
      destinationWidth,
      destinationHeight,
    );
    if (options.selected) {
      const pulse = Number.isFinite(options.pulse) ? options.pulse! : 1;
      drawSelectedEdge(ctx, left, top, destinationWidth, destinationHeight, options.edgeColor ?? "#fff16b", pulse);
    }
  } catch {
    return false;
  } finally {
    ctx.restore();
  }

  return true;
}
