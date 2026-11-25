import * as THREE from 'three';

export type BannerKind = 'goal' | 'miss' | 'post' | 'save' | 'wall';

export interface HudState {
  goals: number;
  shots: number;
  hint: string;
  banner: { text: string; kind: BannerKind } | null;
}

export interface CanvasHud {
  resize(width: number, height: number, dpr: number): void;
  setState(partial: Partial<HudState>): void;
  render(renderer: THREE.WebGLRenderer): void;
}

const BANNER_COLORS: Record<BannerKind, { text: string; border: string }> = {
  goal: { text: '#7dff9b', border: 'rgba(125, 255, 155, 0.55)' },
  miss: { text: '#ff8e7a', border: 'rgba(255, 142, 122, 0.55)' },
  post: { text: '#ffd66b', border: 'rgba(255, 214, 107, 0.55)' },
  save: { text: '#72d4ff', border: 'rgba(114, 212, 255, 0.55)' },
  wall: { text: '#ffb86c', border: 'rgba(255, 184, 108, 0.55)' },
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Renders all HUD text (title, hint, scoreboard, result banner) onto a crisp 2D canvas
 * composited directly inside the main WebGL canvas via an orthographic overlay pass.
 */
export function createCanvasHud(): CanvasHud {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
  );
  scene.add(quad);

  const state: HudState = {
    goals: 0,
    shots: 0,
    hint: 'Topa basıp kaleye doğru falso çiz ve bırak',
    banner: null,
  };

  let viewW = 1;
  let viewH = 1;
  let pixelRatio = 1;
  let dirty = true;

  function redraw() {
    dirty = false;
    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    const compact = viewW < 640;
    const padX = compact ? 16 : 24;
    const padY = compact ? 14 : 20;

    // Top-left title & hint
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#f4f6f3';
    ctx.font = `800 ${compact ? 22 : 28}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillText('SCORE KICK', padX, padY);

    ctx.font = `500 ${compact ? 12 : 13}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(244, 246, 243, 0.88)';
    ctx.fillText(state.hint, padX, padY + (compact ? 28 : 34));

    // Top-right scoreboard box
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const boxW = compact ? 118 : 136;
    const boxH = compact ? 50 : 56;
    const boxX = viewW - padX - boxW;
    const boxY = padY;

    roundRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fillStyle = 'rgba(10, 18, 13, 0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const drawStat = (label: string, val: number, cx: number) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244, 246, 243, 0.72)';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.fillText(label, cx, boxY + 9);

      ctx.fillStyle = '#f4f6f3';
      ctx.font = `800 ${compact ? 18 : 21}px Inter, system-ui, sans-serif`;
      ctx.fillText(String(val), cx, boxY + 23);
    };

    drawStat('GOL', state.goals, boxX + boxW * 0.28);
    drawStat('ŞUT', state.shots, boxX + boxW * 0.72);

    // Center result banner
    if (state.banner) {
      const palette = BANNER_COLORS[state.banner.kind];
      const fontSize = compact ? 34 : 50;
      ctx.font = `900 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
      const metrics = ctx.measureText(state.banner.text);
      const bw = Math.max(180, metrics.width + 56);
      const bh = compact ? 64 : 84;
      const bx = (viewW - bw) / 2;
      const by = viewH * 0.42 - bh / 2;

      roundRect(ctx, bx, by, bw, bh, 16);
      ctx.fillStyle = 'rgba(10, 18, 13, 0.72)';
      ctx.fill();
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.text;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 8;
      ctx.fillText(state.banner.text, viewW / 2, by + bh / 2 + 2);
    }

    ctx.restore();
    tex.needsUpdate = true;
  }

  function resize(width: number, height: number, dpr: number) {
    viewW = Math.max(1, width);
    viewH = Math.max(1, height);
    pixelRatio = dpr;
    cv.width = Math.round(viewW * dpr);
    cv.height = Math.round(viewH * dpr);
    dirty = true;
  }

  function setState(partial: Partial<HudState>) {
    Object.assign(state, partial);
    dirty = true;
  }

  function render(renderer: THREE.WebGLRenderer) {
    if (dirty) redraw();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = prevAutoClear;
  }

  return { resize, setState, render };
}

