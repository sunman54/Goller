import * as THREE from 'three';

export const GOAL = {
  width: 7.32,
  height: 2.44,
  depth: 2.0,
  postRadius: 0.06,
  z: 0,
} as const;

export interface NetRipple {
  point: THREE.Vector3;
  strength: number;
  age: number;
}

export interface Pitch {
  group: THREE.Group;
  rippleNet(worldPoint: THREE.Vector3, strength: number): void;
  update(dt: number): void;
}

/**
 * Creates lush, vibrant professional stadium turf texture
 * with alternating mowed stripes and fine grass blade detail.
 */
function createGrassTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;

  const bCv = document.createElement('canvas');
  bCv.width = bCv.height = size;
  const bCtx = bCv.getContext('2d')!;

  // 1. Alternating vibrant mowed grass stripes (championship pitch)
  const stripes = 8;
  const sw = size / stripes;
  const lightGreen = '#2e8b45';
  const darkGreen = '#247537';

  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = (i % 2 === 0) ? lightGreen : darkGreen;
    ctx.fillRect(0, i * sw, size, sw);
  }

  // 2. Micro grass blade noise
  const img = ctx.getImageData(0, 0, size, size);
  const bImg = bCtx.createImageData(size, size);
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n * 0.7));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n * 0.6));

    const bump = Math.min(255, Math.max(0, 128 + n * 3.5));
    bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = bump;
    bImg.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const mapTex = new THREE.CanvasTexture(cv);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.wrapS = mapTex.wrapT = THREE.RepeatWrapping;
  mapTex.repeat.set(8, 12);
  mapTex.anisotropy = 8;

  const bumpTex = new THREE.CanvasTexture(bCv);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(8, 12);
  bumpTex.anisotropy = 8;

  return { map: mapTex, bump: bumpTex };
}

function createNetTexture(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 4;

  const step = 32;
  ctx.beginPath();
  for (let i = 0; i <= size; i += step) {
    ctx.moveTo(i, 0); ctx.lineTo(i, size);
    ctx.moveTo(0, i); ctx.lineTo(size, i);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function addLine(parent: THREE.Group, x: number, z: number, w: number, l: number) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.005, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function createPitch(): Pitch {
  const group = new THREE.Group();

  // 1. Vibrant championship turf field
  const { map: grassTex, bump: grassBump } = createGrassTextures();
  const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    bumpMap: grassBump,
    bumpScale: 0.004,
    roughness: 0.82,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 14);
  ground.receiveShadow = true;
  group.add(ground);

  // 2. Crisp white pitch markings
  const lw = 0.12;
  addLine(group, 0, 0, 68, lw);
  addLine(group, -34, 24, lw, 48);
  addLine(group, 34, 24, lw, 48);

  // Penalty area (40.32m wide, 16.5m deep)
  addLine(group, 0, 16.5, 40.32, lw);
  addLine(group, -20.16, 8.25, lw, 16.5);
  addLine(group, 20.16, 8.25, lw, 16.5);

  // Goal area (18.32m wide, 5.5m deep)
  addLine(group, 0, 5.5, 18.32, lw);
  addLine(group, -9.16, 2.75, lw, 5.5);
  addLine(group, 9.16, 2.75, lw, 5.5);

  // Penalty spot
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.006, 11);
  spot.receiveShadow = true;
  group.add(spot);

  // Penalty arc
  const arcHalfAngle = Math.acos((16.5 - 11) / 9.15);
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(9.15 - lw / 2, 9.15 + lw / 2, 48, 1, Math.PI / 2 - arcHalfAngle, arcHalfAngle * 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  );
  arc.rotation.x = -Math.PI / 2;
  arc.position.set(0, 0.005, 11);
  arc.receiveShadow = true;
  group.add(arc);

  // 3. Goal posts and crossbar (Glossy white enamel finish)
  const hw = GOAL.width / 2;
  const h = GOAL.height;
  const d = GOAL.depth;
  const r = GOAL.postRadius;
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.15,
  });

  const makeCyl = (rad: number, len: number) => new THREE.CylinderGeometry(rad, rad, len, 24);

  const leftPost = new THREE.Mesh(makeCyl(r, h), postMat);
  leftPost.position.set(-hw, h / 2, 0);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(makeCyl(r, h), postMat);
  rightPost.position.set(hw, h / 2, 0);
  rightPost.castShadow = true;

  const crossbar = new THREE.Mesh(makeCyl(r, GOAL.width + r * 2), postMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, h, 0);
  crossbar.castShadow = true;

  // Back support frame
  const sr = 0.032;
  const backGround = new THREE.Mesh(makeCyl(sr, GOAL.width), postMat);
  backGround.rotation.z = Math.PI / 2;
  backGround.position.set(0, sr, -d);

  const backTop = new THREE.Mesh(makeCyl(sr, GOAL.width), postMat);
  backTop.rotation.z = Math.PI / 2;
  backTop.position.set(0, h, -d * 0.82);

  for (const sx of [-hw, hw]) {
    const sideBottom = new THREE.Mesh(makeCyl(sr, d), postMat);
    sideBottom.rotation.x = Math.PI / 2;
    sideBottom.position.set(sx, sr, -d / 2);
    group.add(sideBottom);

    const sideTop = new THREE.Mesh(makeCyl(sr, d * 0.82), postMat);
    sideTop.rotation.x = Math.PI / 2;
    sideTop.position.set(sx, h, (-d * 0.82) / 2);
    group.add(sideTop);

    const dy = h - sr;
    const dz = d - d * 0.82;
    const strutLen = Math.hypot(dy, dz);
    const strut = new THREE.Mesh(makeCyl(sr, strutLen), postMat);
    strut.position.set(sx, (h + sr) / 2, (-d - d * 0.82) / 2);
    strut.rotation.x = -Math.atan2(dz, dy);
    group.add(strut);
  }
  group.add(leftPost, rightPost, crossbar, backGround, backTop);

  // 4. Deformable goal net panels
  const netTex = createNetTexture();
  const netPanels: { mesh: THREE.Mesh; basePos: Float32Array; normal: THREE.Vector3 }[] = [];

  const createNetPanel = (w: number, ph: number, segX: number, segY: number, repX: number, repY: number) => {
    const tex = netTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(repX, repY);
    const geo = new THREE.PlaneGeometry(w, ph, segX, segY);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    return { mesh, geo };
  };

  // Back net
  {
    const backH = Math.hypot(h, d * 0.18);
    const { mesh, geo } = createNetPanel(GOAL.width, backH, 24, 10, 26, 9);
    mesh.position.set(0, h / 2, -d * 0.91);
    mesh.rotation.x = -Math.atan2(d * 0.18, h);
    group.add(mesh);
    netPanels.push({
      mesh,
      basePos: new Float32Array(geo.attributes.position.array),
      normal: new THREE.Vector3(0, 0, -1),
    });
  }
  // Top net
  {
    const { mesh, geo } = createNetPanel(GOAL.width, d * 0.82, 24, 8, 26, 7);
    mesh.position.set(0, h, (-d * 0.82) / 2);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    netPanels.push({
      mesh,
      basePos: new Float32Array(geo.attributes.position.array),
      normal: new THREE.Vector3(0, 1, 0),
    });
  }
  // Side nets
  for (const side of [-1, 1]) {
    const { mesh, geo } = createNetPanel(d * 0.92, h, 10, 10, 7, 9);
    mesh.position.set(side * hw, h / 2, -d * 0.46);
    mesh.rotation.y = side * (Math.PI / 2);
    group.add(mesh);
    netPanels.push({
      mesh,
      basePos: new Float32Array(geo.attributes.position.array),
      normal: new THREE.Vector3(side, 0, 0),
    });
  }

  const ripples: NetRipple[] = [];
  const tmpLocal = new THREE.Vector3();

  function rippleNet(worldPoint: THREE.Vector3, strength: number) {
    ripples.push({ point: worldPoint.clone(), strength: Math.min(1.2, strength), age: 0 });
  }

  function update(dt: number) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age > 1.4) ripples.splice(i, 1);
    }

    for (const panel of netPanels) {
      const posAttr = panel.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const base = panel.basePos;
      if (ripples.length === 0) {
        arr.set(base);
        posAttr.needsUpdate = true;
        continue;
      }
      panel.mesh.updateMatrixWorld();
      const invMat = panel.mesh.matrixWorld.clone().invert();
      for (let v = 0; v < posAttr.count; v++) {
        const bx = base[v * 3];
        const by = base[v * 3 + 1];
        const bz = base[v * 3 + 2];
        let disp = 0;
        for (const rp of ripples) {
          tmpLocal.copy(rp.point).applyMatrix4(invMat);
          const dist = Math.hypot(bx - tmpLocal.x, by - tmpLocal.y);
          const env = Math.exp(-dist * 1.1) * Math.exp(-rp.age * 3.2);
          const wave = Math.sin(rp.age * 20 - dist * 5);
          disp += rp.strength * env * (0.35 + 0.65 * Math.max(0, wave));
        }
        arr[v * 3] = bx;
        arr[v * 3 + 1] = by;
        arr[v * 3 + 2] = bz - disp * 0.45;
      }
      posAttr.needsUpdate = true;
    }
  }

  return { group, rippleNet, update };
}
