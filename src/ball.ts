import * as THREE from 'three';

export const BALL_RADIUS = 0.11;

export interface Ball {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  reset(x: number, z: number): void;
  sync(dt: number): void;
}

function createMatchBallTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  const bCv = document.createElement('canvas');
  bCv.width = W;
  bCv.height = H;
  const bCtx = bCv.getContext('2d')!;

  // 1. Pristine pearlescent white base
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // 2. Clear neutral bump base
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, W, H);

  // 3. Dynamic modern aerodynamic ribbon graphics (cyan, magenta, gold speed swooshes)
  const drawSwoosh = (startX: number, startY: number, color1: string, color2: string) => {
    ctx.save();
    ctx.translate(startX, startY);

    const grad = ctx.createLinearGradient(0, 0, 180, 80);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(60, -40, 140, 20, 220, -10);
    ctx.bezierCurveTo(150, 40, 80, 10, 0, 0);
    ctx.fill();

    // Gold accent trim line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };

  drawSwoosh(120, 160, '#06b6d4', '#3b82f6');
  drawSwoosh(630, 160, '#06b6d4', '#3b82f6');
  drawSwoosh(380, 340, '#ec4899', '#f43f5e');
  drawSwoosh(890, 340, '#ec4899', '#f43f5e');

  // 4. Hexagonal / Pentagonal panel seams (Color & Bump)
  const cols = 6;
  const rows = 3;

  const drawSeamPolygon = (cx: number, cy: number, r: number, sides: number, fill?: string) => {
    ctx.save();
    bCtx.save();

    ctx.beginPath();
    bCtx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) {
        ctx.moveTo(px, py);
        bCtx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
        bCtx.lineTo(px, py);
      }
    }
    ctx.closePath();
    bCtx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    // Panel boundary seam groove (dark line on color, deep groove on bump)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 4;
    ctx.stroke();

    bCtx.strokeStyle = '#202020'; // Deep recessed groove
    bCtx.lineWidth = 6;
    bCtx.stroke();

    ctx.restore();
    bCtx.restore();
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const ox = (r % 2) * (W / cols / 2);
      const cx = (c * (W / cols) + ox) % (W + 50);
      const cy = ((r + 0.5) / rows) * H;
      const rad = r === 1 ? 46 : 38;

      drawSeamPolygon(cx, cy, rad, 5, '#0f172a');
      if (cx < 60) drawSeamPolygon(cx + W, cy, rad, 5, '#0f172a');
    }
  }

  // 5. Official Match Ball FIFA Pro Brand Badge
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText('SCORE PRO MATCH', W * 0.5, H * 0.28);
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle = '#d97706';
  ctx.fillText('★ ★ ★ ★ ★ FIFA APPROVED', W * 0.5, H * 0.33);
  ctx.restore();

  // 6. Micro Aerodynamic Golf-Ball Dimple Texture on Bump Map
  const bImg = bCtx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const dimple = ((x % 8 - 4) ** 2 + (y % 8 - 4) ** 2 < 7) ? -18 : 6;
      bImg.data[idx] = Math.min(255, Math.max(0, bImg.data[idx] + dimple));
      bImg.data[idx + 1] = Math.min(255, Math.max(0, bImg.data[idx + 1] + dimple));
      bImg.data[idx + 2] = Math.min(255, Math.max(0, bImg.data[idx + 2] + dimple));
    }
  }
  bCtx.putImageData(bImg, 0, 0);

  const mapTex = new THREE.CanvasTexture(cv);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 8;

  const bumpTex = new THREE.CanvasTexture(bCv);
  bumpTex.anisotropy = 8;

  return { map: mapTex, bump: bumpTex };
}

function createShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

export function createBall(scene: THREE.Scene): Ball {
  const { map, bump } = createMatchBallTextures();

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 36, 28),
    new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.006,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
    }),
  );
  mesh.castShadow = true;
  scene.add(mesh);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  scene.add(shadow);

  const pos = new THREE.Vector3(0, BALL_RADIUS, 20);
  const vel = new THREE.Vector3();
  const spin = new THREE.Vector3();
  const qDelta = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  function reset(x: number, z: number) {
    pos.set(x, BALL_RADIUS, z);
    vel.set(0, 0, 0);
    spin.set(0, 0, 0);
    mesh.position.copy(pos);
    mesh.quaternion.identity();
    sync(0);
  }

  function sync(dt: number) {
    mesh.position.copy(pos);
    const omega = spin.length();
    if (omega > 1e-4 && dt > 0) {
      axis.copy(spin).divideScalar(omega);
      qDelta.setFromAxisAngle(axis, omega * dt);
      mesh.quaternion.premultiply(qDelta);
    }

    // Contact shadow softens and widens as the ball rises
    const h = Math.max(0, pos.y - BALL_RADIUS);
    const s = 1 + h * 0.55;
    shadow.position.set(pos.x, 0.008, pos.z);
    shadow.scale.set(s, s, 1);
    shadowMat.opacity = Math.max(0.08, 0.85 * Math.exp(-h * 0.55));
  }

  reset(0, 20);
  return { mesh, shadow, pos, vel, spin, reset, sync };
}
