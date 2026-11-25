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

function createBallTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = '#f5f6f3';
  ctx.fillRect(0, 0, w, h);

  // Subtle leather grain & seams
  ctx.strokeStyle = 'rgba(30, 35, 32, 0.25)';
  ctx.lineWidth = 2;

  const drawPentagon = (cx: number, cy: number, r: number, fill: string) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };

  // Classic tiled pentagon patches in equirectangular layout
  const cols = 6;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const ox = (r % 2) * (w / cols / 2);
      const cx = (c * (w / cols) + ox) % (w + 30);
      const cy = ((r + 0.5) / rows) * h;
      const rad = r === 1 ? 23 : 18;
      drawPentagon(cx, cy, rad, '#181c1a');
      if (cx < 30) drawPentagon(cx + w, cy, rad, '#181c1a');
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

export function createBall(scene: THREE.Scene): Ball {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({
      map: createBallTexture(),
      roughness: 0.42,
      metalness: 0.04,
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

