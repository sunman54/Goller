/**
 * humanoid.ts – Cartoon-style articulated character rig.
 *
 * Proportions: big round head (~30 % of total height), stubby limbs,
 * round belly – built entirely from spheres, cylinders and boxes so it
 * reads as cute/fun rather than anatomically realistic.
 */
import * as THREE from 'three';

export interface HumanoidMaterials {
  jersey: THREE.Material;
  shorts: THREE.Material;
  socks: THREE.Material;
  boots: THREE.Material;
  skin: THREE.Material;
  hair: THREE.Material;
  gloves?: THREE.Material;
}

export interface HumanoidRig {
  group: THREE.Group;
  hips: THREE.Group;
  torsoPivot: THREE.Group;
  neckPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArm: { shoulder: THREE.Group; elbow: THREE.Group };
  rightArm: { shoulder: THREE.Group; elbow: THREE.Group };
  leftLeg: { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group };
  rightLeg: { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group };
}

/* ── helpers ──────────────────────────────────────────────────────── */

function sphere(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat);
  m.castShadow = true;
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 2, 2), mat);
  m.castShadow = true;
  return m;
}

/* ── factory ──────────────────────────────────────────────────────── */

/**
 * Builds a cartoon footballer rig facing local −Z.
 * Total height ≈ 1.65 m.  Head is ~0.38 m diameter – about ¼ of height.
 */
export function createHumanoid(mats: HumanoidMaterials): HumanoidRig {
  const group = new THREE.Group();

  /* ── HIPS / PELVIS ───────────────────────────────────────────────
     Sits at y = 0.72.  Wide, round – shorts as a flattened sphere.  */
  const hips = new THREE.Group();
  hips.position.y = 0.72;
  group.add(hips);

  const pelvis = sphere(0.19, mats.shorts, 1.5, 0.75, 1.1);
  hips.add(pelvis);

  /* ── TORSO ───────────────────────────────────────────────────────
     Egg-shaped belly, tapering up to narrower shoulders.           */
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.06;
  hips.add(torsoPivot);

  // Belly (round)
  const belly = sphere(0.19, mats.jersey, 1.1, 1.0, 1.0);
  belly.position.y = 0.14;
  torsoPivot.add(belly);

  // Chest (slightly narrower)
  const chest = sphere(0.165, mats.jersey, 1.1, 0.95, 0.9);
  chest.position.y = 0.33;
  torsoPivot.add(chest);

  // Jersey number on chest (flat decal plane)
  const numTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '900 72px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const numDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.18),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false })
  );
  numDecal.position.set(0, 0.32, -0.17);
  torsoPivot.add(numDecal);

  /* ── NECK ────────────────────────────────────────────────────────*/
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.46;
  torsoPivot.add(neckPivot);

  const neck = cyl(0.07, 0.085, 0.1, mats.skin);
  neck.position.y = 0.05;
  neckPivot.add(neck);

  /* ── HEAD ────────────────────────────────────────────────────────
     Large round cartoon head (r ≈ 0.19 m), offset upward.         */
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.11;
  neckPivot.add(headPivot);

  // Cranium
  const head = sphere(0.19, mats.skin, 1.0, 1.08, 0.98);
  head.position.y = 0.19;
  headPivot.add(head);

  // Big cartoon eyes (white sclera + dark pupil spheres)
  for (const [sx, ex] of [[-1, -0.072], [1, 0.072]] as [number, number][]) {
    const sclera = sphere(0.045, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    sclera.position.set(ex, 0.21, -0.175);
    headPivot.add(sclera);

    const pupil = sphere(0.025, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }));
    pupil.position.set(ex, 0.21, -0.198);
    headPivot.add(pupil);

    // Eyebrow
    const brow = box(0.065, 0.016, 0.014,
      new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.8 }));
    brow.position.set(ex, 0.258, -0.178);
    brow.rotation.z = sx * 0.18;
    headPivot.add(brow);
  }

  // Cartoon nose (tiny sphere bump)
  const nose = sphere(0.028, mats.skin);
  nose.position.set(0, 0.185, -0.21);
  headPivot.add(nose);

  // Mouth line (thin dark box)
  const mouth = box(0.07, 0.014, 0.014,
    new THREE.MeshStandardMaterial({ color: 0x8b2020, roughness: 0.9 }));
  mouth.position.set(0, 0.158, -0.2);
  headPivot.add(mouth);

  // Ear blobs
  for (const ex of [-0.195, 0.195]) {
    const ear = sphere(0.045, mats.skin, 0.6, 1.0, 0.5);
    ear.position.set(ex, 0.195, 0.015);
    headPivot.add(ear);
  }

  // Hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.197, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mats.hair
  );
  hair.position.set(0, 0.19, 0.012);
  hair.rotation.x = -0.08;
  hair.castShadow = true;
  headPivot.add(hair);

  /* ── ARMS ────────────────────────────────────────────────────────
     Short, stubby cartoon arms.                                    */
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 0.36, 0);
    torsoPivot.add(shoulder);

    // Shoulder ball
    const shBall = sphere(0.07, mats.skin);
    shBall.position.y = -0.02;
    shoulder.add(shBall);

    // Upper arm (jersey-covered, stubby cylinder)
    const upper = cyl(0.062, 0.07, 0.17, mats.jersey);
    upper.position.y = -0.1;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.19;
    shoulder.add(elbow);

    // Forearm
    const fore = cyl(0.052, 0.062, 0.14, mats.skin);
    fore.position.y = -0.07;
    elbow.add(fore);

    // Hand / glove – big round cartoon fist
    const handMat = mats.gloves ?? mats.skin;
    const fist = sphere(0.07, handMat, 1.1, 0.95, 0.9);
    fist.position.y = -0.16;
    elbow.add(fist);

    // Thumb blob
    const thumb = sphere(0.04, handMat);
    thumb.position.set(side * 0.045, -0.14, -0.03);
    elbow.add(thumb);

    return { shoulder, elbow };
  };

  /* ── LEGS ────────────────────────────────────────────────────────
     Short thick legs with big round boots.                         */
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.08, 0);
    hips.add(hip);

    // Thigh (shorts-covered cylinder, slightly tapered)
    const thigh = cyl(0.085, 0.1, 0.22, mats.shorts);
    thigh.position.y = -0.11;
    hip.add(thigh);

    // Thigh bottom ball (knee area)
    const kneeBall = sphere(0.085, mats.socks, 1.0, 0.85, 1.0);
    kneeBall.position.y = -0.23;
    hip.add(kneeBall);

    const knee = new THREE.Group();
    knee.position.y = -0.26;
    hip.add(knee);

    // Shin (sock-covered)
    const shin = cyl(0.068, 0.082, 0.2, mats.socks);
    shin.position.y = -0.1;
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.y = -0.21;
    knee.add(ankle);

    // Big cartoon boot
    const bootBody = sphere(0.095, mats.boots, 1.0, 0.72, 1.35);
    bootBody.position.set(0, -0.025, -0.03);
    ankle.add(bootBody);

    // Boot toe cap (extra sphere pushed forward)
    const toeCap = sphere(0.07, mats.boots, 0.9, 0.65, 1.0);
    toeCap.position.set(0, -0.025, -0.115);
    ankle.add(toeCap);

    return { hip, knee, ankle };
  };

  return {
    group,
    hips,
    torsoPivot,
    neckPivot,
    headPivot,
    leftArm: makeArm(-1),
    rightArm: makeArm(1),
    leftLeg: makeLeg(-1),
    rightLeg: makeLeg(1),
  };
}
