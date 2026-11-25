/**
 * stadium.ts – procedural stadium stands behind the goal (stands on the -Z side).
 * No external assets; everything is generated from geometry and canvas textures.
 */
import * as THREE from 'three';

/** Create a crowd-texture: rows of coloured dots on a dark background */
function createCrowdTexture(): THREE.CanvasTexture {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;

  ctx.fillStyle = '#121b1e';
  ctx.fillRect(0, 0, W, H);

  const palette = [
    '#e63946','#457b9d','#f1faee','#2a9d8f',
    '#e9c46a','#f4a261','#ffffff','#264653',
    '#06d6a0','#ef476f','#ffd166','#118ab2',
  ];

  let seed = 9871;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const rows = 14, cols = 48;
  const rw = W / cols, rh = H / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * rw + (rng() - 0.5) * rw * 0.5;
      const cy = (r + 0.5) * rh + (rng() - 0.5) * rh * 0.5;
      const radius = rw * 0.28 + rng() * rw * 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.fill();
      // tiny head-shadow
      ctx.beginPath();
      ctx.arc(cx, cy + radius * 0.55, radius * 0.55, 0, Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Create seat-colour strip texture (alternating team colours) */
function createSeatTexture(): THREE.CanvasTexture {
  const W = 256, H = 64;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const cols = ['#b30000','#c8203b','#9e1515','#d42b3a'];
  const sw = W / cols.length;
  cols.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * sw, 0, sw, H);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = 6;
  return tex;
}

export function createStadium(scene: THREE.Scene) {
  const group = new THREE.Group();

  const crowdTex = createCrowdTexture();
  const seatTex = createSeatTexture();

  const crowdMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.9,
    metalness: 0.0,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    map: seatTex,
    roughness: 0.88,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x3b4245,
    roughness: 0.9,
  });

  // --- BACK STAND (behind goal, -Z direction) ---
  const TIERS = 3;
  const TIER_DEPTH = 7;      // depth of each tier (m)
  const TIER_HEIGHT = 5.5;   // height rise per tier
  const STAND_WIDTH = 52;

  for (let t = 0; t < TIERS; t++) {
    const startZ = -(6 + t * TIER_DEPTH);
    const baseY = t * TIER_HEIGHT;

    // concrete riser
    const riserGeo = new THREE.BoxGeometry(STAND_WIDTH, TIER_HEIGHT, TIER_DEPTH);
    const riser = new THREE.Mesh(riserGeo, concreteMat);
    riser.position.set(0, baseY + TIER_HEIGHT / 2, startZ - TIER_DEPTH / 2);
    riser.receiveShadow = true;
    group.add(riser);

    // seat strip (front face of riser, slightly inset)
    const seatGeo = new THREE.PlaneGeometry(STAND_WIDTH, TIER_HEIGHT * 0.72);
    const seats = new THREE.Mesh(seatGeo, seatMat);
    seats.position.set(0, baseY + TIER_HEIGHT * 0.4, startZ + 0.03);
    group.add(seats);

    // crowd layer (tilted back face = visible from camera)
    const crowdGeo = new THREE.PlaneGeometry(STAND_WIDTH, TIER_DEPTH * 1.1);
    const crowd = new THREE.Mesh(crowdGeo, crowdMat);
    crowd.rotation.x = -Math.PI / 2 + 0.32;
    crowd.position.set(0, baseY + TIER_HEIGHT + 0.1, startZ - TIER_DEPTH * 0.55);
    crowd.receiveShadow = true;
    group.add(crowd);
  }

  // --- SIDE STANDS (left & right, partial) ---
  for (const side of [-1, 1]) {
    const sx = side * (STAND_WIDTH / 2 + 1.5);
    for (let t = 0; t < 2; t++) {
      const startZ = 8 - t * TIER_DEPTH;
      const baseY = t * TIER_HEIGHT * 0.9;

      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(10, TIER_HEIGHT * 0.9, TIER_DEPTH),
        concreteMat
      );
      riser.position.set(sx + side * 4.5, baseY + (TIER_HEIGHT * 0.9) / 2, startZ - TIER_DEPTH / 2);
      riser.receiveShadow = true;
      group.add(riser);

      const crowd = new THREE.Mesh(
        new THREE.PlaneGeometry(TIER_DEPTH * 1.1, TIER_HEIGHT * 0.85),
        crowdMat
      );
      crowd.rotation.y = -side * Math.PI / 2;
      crowd.position.set(sx + side * 0.1, baseY + TIER_HEIGHT * 0.42, startZ - TIER_DEPTH / 2);
      group.add(crowd);
    }
  }

  // --- FLOODLIGHT TOWERS ---
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xd4d8db, roughness: 0.5, metalness: 0.3 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffde8, emissive: new THREE.Color(0xfffacc), emissiveIntensity: 2.0, roughness: 0.1 });

  for (const [tx, tz] of [[-28, -20], [28, -20], [-28, 28], [28, 28]] as [number,number][]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 24, 10), towerMat);
    pole.position.set(tx, 12, tz);
    pole.castShadow = true;
    group.add(pole);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.5, 1.2), lampMat);
    lamp.position.set(tx, 24.3, tz);
    group.add(lamp);

    // point light from each tower
    const ptLight = new THREE.PointLight(0xfff8e7, 1.6, 65, 1.5);
    ptLight.position.set(tx, 24, tz);
    group.add(ptLight);
  }

  // --- ROOFTOP OVERHANG for back stand (simple box) ---
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(STAND_WIDTH + 2, 0.6, TIER_DEPTH * TIERS + 2),
    concreteMat
  );
  roof.position.set(0, TIER_HEIGHT * TIERS + 0.4, -(6 + TIER_DEPTH * TIERS / 2));
  group.add(roof);

  scene.add(group);
  return group;
}

