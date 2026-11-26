import * as THREE from 'three';

/** Deterministic fast 2D hash for procedural textures */
function hash2(x: number, y: number, seed = 1337): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1] */
function vnoise(x: number, y: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

function toTex(cv: HTMLCanvasElement, srgb = true, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export interface JerseyStyle {
  baseColor: string;
  accentColor: string;
  trimColor: string;
  numberText?: string;
  isGoalkeeper?: boolean;
}

/**
 * Creates high-end procedural athletic jersey material with:
 * - Breathable honeycomb / pique micro-knit weave
 * - Aerodynamic ventilation micro-perforations
 * - Detailed silicone club crest badge & athletic chest sponsor/graphic
 * - Crisp vinyl player number with outline
 * - Physical sheen and roughness maps to simulate woven fabric vs silicone/vinyl
 */
export function createJerseyMaterial(style: JerseyStyle): THREE.MeshPhysicalMaterial {
  const W = 512;
  const H = 512;
  const [cv, ctx] = makeCanvas(W, H);
  const [bCv, bCtx] = makeCanvas(W, H);
  const [rCv, rCtx] = makeCanvas(W, H);

  // 1. Base jersey color
  ctx.fillStyle = style.baseColor;
  ctx.fillRect(0, 0, W, H);

  // Pattern styling
  if (style.isGoalkeeper) {
    // Dynamic geometric GK pattern
    ctx.fillStyle = style.accentColor;
    for (let y = 0; y < H; y += 48) {
      for (let x = 0; x < W; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 48, y + 24);
        ctx.lineTo(x + 24, y + 48);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    // Athletic subtle gradient / jacquard vertical stripes
    ctx.fillStyle = style.accentColor;
    for (let x = 0; x < W; x += 64) {
      ctx.fillRect(x, 0, 24, H);
    }
    // Contrast raglan shoulder accents
    ctx.fillStyle = style.trimColor;
    ctx.fillRect(0, 0, W, 22);
    ctx.fillRect(0, H - 28, W, 28);
  }

  // 2. Club Crest Badge (Left Chest)
  const drawCrest = (cx: number, cy: number, size: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    // Shield
    ctx.beginPath();
    ctx.moveTo(-size * 0.7, -size * 0.8);
    ctx.lineTo(size * 0.7, -size * 0.8);
    ctx.lineTo(size * 0.7, 0);
    ctx.quadraticCurveTo(size * 0.7, size * 0.9, 0, size * 1.1);
    ctx.quadraticCurveTo(-size * 0.7, size * 0.9, -size * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b'; // Gold trim
    ctx.lineWidth = 4;
    ctx.stroke();

    // Internal star & soccer ball
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawCrest(W * 0.28, H * 0.32, 28);

  // 3. Chest Athletic Brand Mark (Right Chest)
  ctx.save();
  ctx.translate(W * 0.72, H * 0.32);
  ctx.fillStyle = style.trimColor;
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.quadraticCurveTo(0, -14, 22, -6);
  ctx.quadraticCurveTo(2, -2, -18, 6);
  ctx.fill();
  ctx.restore();

  // 4. Chest Sponsor Logo
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText('EMIRATES', W * 0.5, H * 0.44);
  ctx.restore();

  // 5. Player Number (Front & Back)
  if (style.numberText) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 130px Inter, system-ui, sans-serif';

    // Shadow / border
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillText(style.numberText, W * 0.5 + 4, H * 0.72 + 4);

    // Number body
    ctx.fillStyle = '#ffffff';
    ctx.fillText(style.numberText, W * 0.5, H * 0.72);
    ctx.restore();
  }

  // 6. Generate Procedural Micro-Weave Bump & Roughness Maps
  const img = ctx.getImageData(0, 0, W, H);
  const bImg = bCtx.createImageData(W, H);
  const rImg = rCtx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // Hexagonal micro-weave pattern
      const hx = (x % 6) - 3;
      const hy = (y % 6) - 3;
      const hexDist = Math.hypot(hx, hy);
      const weave = hexDist < 2.0 ? 1 : -1;

      // Ventilation dots on sides
      const isSideVent = (x < W * 0.12 || x > W * 0.88) && (y % 10 < 3 && x % 10 < 3);

      // Noise grain
      const n = (vnoise(x * 0.3, y * 0.3, 101) - 0.5) * 12;
      const delta = weave * 6 + (isSideVent ? -24 : 0) + n;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + delta));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + delta));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + delta));

      // Bump: fabric weave + ventilation indentations
      const bump = Math.min(255, Math.max(0, 128 + weave * 32 + (isSideVent ? -55 : 0) + n * 2));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;

      // Roughness: fabric is matte (~205), vinyl numbers and badge are smoother (~85)
      const isNumberOrBadge = (y > H * 0.24 && y < H * 0.40 && (x < W * 0.36 || x > W * 0.64)) ||
                              (style.numberText && y > H * 0.56 && y < H * 0.88 && x > W * 0.32 && x < W * 0.68);
      const rough = isNumberOrBadge ? 85 : Math.min(255, Math.max(0, 195 - weave * 18 + n));
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.007,
    roughnessMap: toTex(rCv, false),
    roughness: 0.76,
    sheen: 0.7,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
  });
}

/**
 * Creates realistic athletic shorts material with waistband stitching and side stripes.
 */
export function createShortsMaterial(baseColor: string, stripeColor: string): THREE.MeshPhysicalMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, S, S);

  // Side contrast speed stripe
  ctx.fillStyle = stripeColor;
  ctx.fillRect(0, 0, 28, S);
  ctx.fillRect(S - 28, 0, 28, S);

  // Elastic waistband detail at top
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(0, 0, S, 16);

  const img = ctx.getImageData(0, 0, S, S);
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      const diagonalTwill = (x + y) % 4 < 2 ? 6 : -6;
      const n = (vnoise(x * 0.25, y * 0.25, 87) - 0.5) * 8;
      const d = diagonalTwill + n;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + d));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + d));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + d));

      const bump = Math.min(255, Math.max(0, 128 + diagonalTwill * 4 + n * 2));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.005,
    roughness: 0.72,
    sheen: 0.45,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0xffffff),
  });
}

/**
 * Creates realistic compression football socks with ribbed shin knit.
 */
export function createSocksMaterial(baseColor: string, stripeColor: string): THREE.MeshPhysicalMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, S, S);

  // Turn-down cuff stripes near top
  ctx.fillStyle = stripeColor;
  ctx.fillRect(0, 20, S, 12);
  ctx.fillRect(0, 44, S, 12);

  const img = ctx.getImageData(0, 0, S, S);
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Horizontal ribbed compression lines
      const rib = Math.sin(y * 0.85) * 14;
      const n = (vnoise(x * 0.35, y * 0.35, 12) - 0.5) * 8;
      const d = rib + n;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + d));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + d));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + d));

      const bump = Math.min(255, Math.max(0, 128 + rib * 3 + n * 2));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.006,
    roughness: 0.78,
    sheen: 0.5,
    sheenRoughness: 0.7,
  });
}

/**
 * Creates elite pro football boots (cleats) with:
 * - 3D touch grip micro-ridges on the vamp for swerve/curve
 * - Glossy speed swoosh graphic
 * - Metallic studs / soleplate reflections
 */
export function createBootMaterial(baseColor = '#111827', accentColor = '#facc15'): THREE.MeshPhysicalMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, S, S);

  // Dynamic speed swoop graphic
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(30, S * 0.6);
  ctx.quadraticCurveTo(S * 0.5, S * 0.2, S - 20, S * 0.35);
  ctx.quadraticCurveTo(S * 0.45, S * 0.45, 30, S * 0.6);
  ctx.fill();

  // Outsole edge accent
  ctx.fillRect(0, S - 24, S, 24);

  const img = ctx.getImageData(0, 0, S, S);
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // High-precision synthetic upper grain & grip fins
      const gripFin = Math.sin((x * 0.5 + y) * 0.4) > 0.4 ? 18 : -10;
      const grain = (vnoise(x * 0.4, y * 0.4, 63) - 0.5) * 12;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + grain));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + grain));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + grain));

      const bump = Math.min(255, Math.max(0, 128 + gripFin * 2 + grain * 2));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.008,
    roughness: 0.32,
    metalness: 0.18,
    clearcoat: 0.65,
    clearcoatRoughness: 0.3,
  });
}

/**
 * Creates realistic human skin with subsurface scattering simulation:
 * - Epidermal micro-pore bump map to eliminate flat plastic look
 * - Subsurface warm glow via sheenColor
 * - Natural healthy skin specular
 */
export function createSkinMaterial(baseHex = '#c48b68'): THREE.MeshPhysicalMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, S, S);

  const img = ctx.getImageData(0, 0, S, S);
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Multi-frequency organic skin noise: tone variations + fine pores
      const tone = (vnoise(x * 0.08, y * 0.08, 19) - 0.5) * 16;
      const pore = (hash2(x, y, 77) - 0.5) * 8;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + tone + pore * 0.8));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + tone * 0.7 + pore * 0.7));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + tone * 0.6 + pore * 0.6));

      const bump = Math.min(255, Math.max(0, 128 + pore * 4));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.0035,
    roughness: 0.54,
    sheen: 0.5,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xff8b70), // Subsurface scattering warmth
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  });
}

/**
 * Creates modern athletic textured hair material.
 */
export function createHairMaterial(baseHex = '#1c1512'): THREE.MeshStandardMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, S, S);

  const img = ctx.getImageData(0, 0, S, S);
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Directional hair flow strands
      const strand = (vnoise(x * 0.8, y * 0.15, 33) - 0.5) * 26;

      img.data[idx] = Math.min(255, Math.max(0, img.data[idx] + strand));
      img.data[idx + 1] = Math.min(255, Math.max(0, img.data[idx + 1] + strand));
      img.data[idx + 2] = Math.min(255, Math.max(0, img.data[idx + 2] + strand));

      const bump = Math.min(255, Math.max(0, 128 + strand * 4));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshStandardMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.009,
    roughness: 0.82,
  });
}

/**
 * Creates professional goalkeeper latex gloves with 3D embossed punching grid.
 */
export function createGloveMaterial(): THREE.MeshPhysicalMaterial {
  const S = 256;
  const [cv, ctx] = makeCanvas(S, S);
  const [bCv, bCtx] = makeCanvas(S, S);

  ctx.fillStyle = '#ffffff'; // White latex palm
  ctx.fillRect(0, 0, S, S);

  // Backhand colorful punching zone
  ctx.fillStyle = '#06b6d4'; // Cyan latex
  ctx.fillRect(0, 0, S, S * 0.55);

  // Grip grid pattern
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= S; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, S);
    ctx.moveTo(0, i); ctx.lineTo(S, i);
    ctx.stroke();
  }

  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      const isGrid = (x % 24 < 3) || (y % 24 < 3);
      const bump = isGrid ? 80 : 160;
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bump;
      bImg.data[idx + 3] = 255;
    }
  }
  bCtx.putImageData(bImg, 0, 0);

  return new THREE.MeshPhysicalMaterial({
    map: toTex(cv, true),
    bumpMap: toTex(bCv, false),
    bumpScale: 0.012,
    roughness: 0.48,
    sheen: 0.35,
  });
}
