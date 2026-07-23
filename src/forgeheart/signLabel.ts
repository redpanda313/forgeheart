/**
 * Canvas-backed world sign labels that wrap / shrink so every word fits.
 */

import * as THREE from 'three';

export interface SignLabelStyle {
  /** Preferred canvas width before growing for long copy */
  width?: number;
  /** Hard max canvas width */
  maxWidth?: number;
  /** Preferred single-line canvas height */
  height?: number;
  /** Hard max canvas height (multi-line) */
  maxHeight?: number;
  maxFont?: number;
  minFont?: number;
  fontFamily?: string;
  fill?: string;
  stroke?: string;
  textColor?: string;
  pad?: number;
  lineWidth?: number;
  /** World-space width of the sprite */
  worldWidth?: number;
  /** Optional SRGB color space on the texture (market / floating city) */
  srgb?: boolean;
  /** When true, SpriteMaterial uses depthTest: false (nameplates) */
  depthTest?: boolean;
  /** Force final canvas to maxWidth × maxHeight (nameplates / plaques) */
  lockFrame?: boolean;
}

export interface SignCanvasResult {
  canvas: HTMLCanvasElement;
  /** canvas height / width */
  aspect: number;
  lineCount: number;
  fontSize: number;
}

function tokenize(text: string): string[] {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [''];
  return raw.split(' ').filter(Boolean);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxInner: number,
): string[] {
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(trial).width <= maxInner) {
      cur = trial;
      continue;
    }
    if (cur) lines.push(cur);
    cur = word;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function widestLine(ctx: CanvasRenderingContext2D, lines: string[]): number {
  let w = 0;
  for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
  return w;
}

/**
 * Lay out sign copy onto a canvas: wrap words, grow canvas, shrink font
 * until every word is fully visible.
 */
export function layoutSignText(text: string, style: SignLabelStyle = {}): SignCanvasResult {
  const minW = Math.max(64, Math.floor(style.width ?? 320));
  const maxW = Math.max(minW, Math.floor(style.maxWidth ?? 720));
  const minH = Math.max(32, Math.floor(style.height ?? 64));
  const maxH = Math.max(minH, Math.floor(style.maxHeight ?? 220));
  const maxFont = style.maxFont ?? 22;
  const minFont = Math.max(8, style.minFont ?? 11);
  const family = style.fontFamily ?? 'system-ui,sans-serif';
  const pad = style.pad ?? 10;
  const fill = style.fill ?? 'rgba(12,16,24,0.8)';
  const stroke = style.stroke ?? '#c4a35a';
  const textColor = style.textColor ?? '#f0e0b0';
  const borderW = style.lineWidth ?? 2;

  const words = tokenize(text);
  const probe = document.createElement('canvas').getContext('2d')!;

  let fontSize = maxFont;
  let width = minW;
  let height = minH;
  let lines: string[] = [words.join(' ')];

  const layoutAt = (size: number, w: number) => {
    probe.font = `bold ${size}px ${family}`;
    const inner = Math.max(8, w - pad * 2);
    const wrapped = wrapLines(probe, words, inner);
    const lineH = size * 1.25;
    const textW = widestLine(probe, wrapped);
    const needH = Math.ceil(pad * 2 + wrapped.length * lineH);
    return { wrapped, lineH, textW, needH };
  };

  // Grow width for long unbroken tokens first
  {
    probe.font = `bold ${fontSize}px ${family}`;
    for (const word of words) {
      const ww = ctxMeasure(probe, word) + pad * 2;
      if (ww > width) width = Math.min(maxW, Math.max(width, Math.ceil(ww)));
    }
  }

  for (;;) {
    const { wrapped, lineH, textW, needH } = layoutAt(fontSize, width);
    lines = wrapped;
    // Grow height for wrapped lines
    if (needH > height) height = Math.min(maxH, Math.max(height, needH));
    const fitsW = textW <= width - pad * 2 + 0.5;
    const fitsH = lines.length * lineH <= height - pad * 2 + 0.5;
    if (fitsW && fitsH) break;
    if (fontSize > minFont) {
      fontSize -= 1;
      continue;
    }
    // Last resort: widen toward max, then accept min font
    if (width < maxW && !fitsW) {
      width = Math.min(maxW, Math.max(width + 32, Math.ceil(textW + pad * 2)));
      continue;
    }
    if (height < maxH && !fitsH) {
      height = Math.min(maxH, Math.max(height, needH));
      continue;
    }
    break;
  }

  const final = layoutAt(fontSize, width);
  lines = final.wrapped;
  height = Math.min(maxH, Math.max(minH, Math.ceil(pad * 2 + lines.length * final.lineH)));
  if (style.lockFrame) {
    width = maxW;
    height = maxH;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = borderW;
  ctx.strokeRect(borderW, borderW, width - borderW * 2, height - borderW * 2);
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const blockH = lines.length * final.lineH;
  const startY = (height - blockH) / 2 + final.lineH / 2;
  for (let i = 0; i < lines.length; i++) {
    // maxWidth ensures a pathological token never paints past the plate
    ctx.fillText(lines[i]!, width / 2, startY + i * final.lineH, width - pad * 2);
  }

  return {
    canvas,
    aspect: height / width,
    lineCount: lines.length,
    fontSize,
  };
}

function ctxMeasure(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width;
}

/** Apply world scale from a desired width, preserving canvas aspect. */
export function setSignWorldWidth(sprite: THREE.Sprite, worldWidth: number) {
  const aspect =
    typeof sprite.userData.signAspect === 'number' ? sprite.userData.signAspect : 0.22;
  sprite.scale.set(worldWidth, worldWidth * aspect, 1);
}

/** Billboard sprite with fitted copy. */
export function makeSignSprite(text: string, style: SignLabelStyle = {}): THREE.Sprite {
  const laid = layoutSignText(text, style);
  const tex = new THREE.CanvasTexture(laid.canvas);
  if (style.srgb) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: style.depthTest !== false,
  });
  const s = new THREE.Sprite(mat);
  s.userData.signAspect = laid.aspect;
  s.userData.signLines = laid.lineCount;
  const worldW = style.worldWidth ?? 3.2;
  setSignWorldWidth(s, worldW);
  return s;
}

/**
 * Paint fitted text into a fixed-size canvas (nameplates / plaques).
 * Shrinks and wraps to keep every word inside the plate.
 */
export function paintFittedSign(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  style: SignLabelStyle = {},
) {
  const laid = layoutSignText(text, {
    ...style,
    width,
    maxWidth: width,
    height,
    maxHeight: height,
    lockFrame: true,
  });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(laid.canvas, 0, 0);
}
