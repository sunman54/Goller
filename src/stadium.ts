import * as THREE from 'three';

/**
 * Creates dynamic glowing LED pitchside advertising boards.
 */
function createLedBoardTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 128;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // Dark gloss LED background
  ctx.fillStyle = '#050b14';
  ctx.fillRect(0, 0, W, H);

  // Gradient glowing banners
  const drawBanner = (x: number, w: number, title: string, subtitle: string, color1: string, color2: string) => {
    const grad = ctx.createLinearGradient(x, 0, x + w, H);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(x + 4, 8, w - 8, H - 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x + w * 0.5, 58);

    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(subtitle, x + w * 0.5, 92);
  };

  drawBanner(0, 256, 'SCORE KICK 3D', 'NEXT GEN MATCH ENGINE', '#dc2626', '#991b1b');
  drawBanner(256, 256, 'HYPERMOTION', 'ADVANCED BALL PHYSICS', '#2563eb', '#1d4ed8');
  drawBanner(512, 256, 'FLY EMIRATES', 'OFFICIAL GLOBAL PARTNER', '#b91c1c', '#7f1d1d');
  drawBanner(768, 256, 'ULTIMATE GOAL', 'PRECISION SHOT CURVE', '#059669', '#047857');

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

/**
 * Creates realistic stadium crowd & tiered seating texture.
 */
function createCrowdTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // Deep stadium bowl atmosphere
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Rows of stadium seats and cheering spectators
  const rows = 28;
  const rowH = H / rows;

  const colors = [
    '#ef4444', '#3b82f6', '#f8fafc', '#e2e8f0',
    '#dc2626', '#2563eb', '#f59e0b', '#10b981',
    '#64748b', '#0284c7', '#ea580c', '#ffffff',
  ];

  let seed = 777;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    // Stadium tier concrete step line
    ctx.fillStyle = r % 2 === 0 ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, y, W, rowH);

    // Spectators in the row
    const cols = 72;
    const colW = W / cols;
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * colW + (rng() - 0.5) * 4;
      const cy = y + rowH * 0.5 + (rng() - 0.5) * 3;
      const rad = 4 + rng() * 2;

      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      ctx.fill();

      // Team scarves and banners randomly
      if (rng() < 0.15) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx - 8, cy - 2, 16, 4);
      }
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStadium(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  // 1. Glowing LED Advertising Boards behind the goal
  const ledTex = createLedBoardTexture();
  const ledMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    roughness: 0.25,
    metalness: 0.1,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: ledTex,
    emissiveIntensity: 0.35,
  });

  const ledBoard = new THREE.Mesh(new THREE.BoxGeometry(46, 1.05, 0.35), ledMat);
  ledBoard.position.set(0, 0.52, -3.8);
  ledBoard.castShadow = true;
  group.add(ledBoard);

  // Side pitch LED boards
  for (const side of [-1, 1]) {
    const sideLed = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.05, 36), ledMat);
    sideLed.position.set(side * 28, 0.52, 12);
    group.add(sideLed);
  }

  // 2. Grandstand Seating Tiers (Modern light architecture)
  const crowdTex = createCrowdTexture();
  const standMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.85,
  });

  const archMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Clean modern architectural steel
    roughness: 0.45,
    metalness: 0.2,
  });

  // Main Grandstand behind goal
  const TIERS = 3;
  const TIER_DEPTH = 8;
  const TIER_HEIGHT = 6;
  const STAND_WIDTH = 58;

  for (let t = 0; t < TIERS; t++) {
    const startZ = -(5.5 + t * TIER_DEPTH);
    const baseY = 1.0 + t * TIER_HEIGHT;

    // Sloped seating tier
    const standGeo = new THREE.PlaneGeometry(STAND_WIDTH, Math.hypot(TIER_DEPTH, TIER_HEIGHT));
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, baseY + TIER_HEIGHT * 0.5, startZ - TIER_DEPTH * 0.5);
    stand.rotation.x = Math.atan2(TIER_DEPTH, TIER_HEIGHT) - Math.PI / 2;
    group.add(stand);

    // Front riser barrier
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(STAND_WIDTH, 0.9, 0.2), archMat);
    barrier.position.set(0, baseY + 0.45, startZ);
    group.add(barrier);
  }

  // Side Grandstands
  for (const side of [-1, 1]) {
    const sx = side * (STAND_WIDTH * 0.5 + 2);
    const sideStandGeo = new THREE.PlaneGeometry(36, 12);
    const sideStand = new THREE.Mesh(sideStandGeo, standMat);
    sideStand.position.set(sx + side * 4, 7, 12);
    sideStand.rotation.y = -side * Math.PI / 2;
    sideStand.rotation.x = -0.35;
    group.add(sideStand);
  }

  // 3. Modern Stadium Cantilever Canopy Roof
  const roofGeo = new THREE.BoxGeometry(STAND_WIDTH + 4, 0.8, TIER_DEPTH * TIERS + 4);
  const roof = new THREE.Mesh(roofGeo, archMat);
  roof.position.set(0, 1.0 + TIER_HEIGHT * TIERS + 2.5, -(5.5 + (TIER_DEPTH * TIERS) * 0.5));
  group.add(roof);

  // 4. Stadium Floodlight Gantries
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xfff7ed),
    emissiveIntensity: 2.5,
  });

  for (const [tx, tz] of [[-26, -18], [26, -18], [-26, 26], [26, 26]] as [number, number][]) {
    // Slender modern floodlight mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 26, 12), archMat);
    mast.position.set(tx, 13, tz);
    group.add(mast);

    // Floodlight bank
    const bank = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.6), archMat);
    bank.position.set(tx, 25.8, tz);
    bank.lookAt(0, 1.5, 8);
    group.add(bank);

    const bulb = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.1, 0.2), lampMat);
    bulb.position.set(0, 0, 0.35);
    bank.add(bulb);

    const light = new THREE.SpotLight(0xfff5ea, 1.8, 85, Math.PI / 4, 0.45, 1.2);
    light.position.set(tx, 25.5, tz);
    light.target.position.set(0, 0, 8);
    scene.add(light.target);
    group.add(light);
  }

  scene.add(group);
  return group;
}
