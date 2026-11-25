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

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeCap(rx: number, ry: number, rz: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

/**
 * Builds a detailed articulated ~1.80 m footballer rig facing local -Z.
 * Improvements over v1:
 *  - Neck segment between torso and head
 *  - Ellipsoid head (more oval, less spherical)
 *  - Ear bumps
 *  - Shoe tip shape (boot has toe cap)
 *  - Muscle-tapered limb segments (using scaled capsule via sphere-capped box)
 *  - Ankle joint added for foot bend
 */
export function createHumanoid(mats: HumanoidMaterials): HumanoidRig {
  const group = new THREE.Group();

  /* ── HIPS ─────────────────────────────────────────── */
  const hips = new THREE.Group();
  hips.position.y = 0.94;
  group.add(hips);

  // Pelvis – wider at hips, slightly tapered
  const pelvis = makeBox(0.34, 0.18, 0.21, mats.shorts);
  hips.add(pelvis);

  /* ── TORSO ────────────────────────────────────────── */
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.09;
  hips.add(torsoPivot);

  // Lower abdomen
  const abdomen = makeBox(0.3, 0.16, 0.2, mats.jersey);
  abdomen.position.y = 0.1;
  torsoPivot.add(abdomen);

  // Chest (wider, slight forward taper for realism)
  const chest = makeBox(0.38, 0.28, 0.22, mats.jersey);
  chest.position.y = 0.33;
  torsoPivot.add(chest);

  // Pectorals hint (two subtle front-face bumps)
  for (const sx of [-0.09, 0.09]) {
    const pec = makeCap(0.1, 0.055, 0.045, mats.jersey);
    pec.position.set(sx, 0.33, -0.11);
    torsoPivot.add(pec);
  }

  /* ── NECK ─────────────────────────────────────────── */
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.5;
  torsoPivot.add(neckPivot);

  const neck = makeBox(0.1, 0.12, 0.1, mats.skin);
  neck.position.y = 0.06;
  neckPivot.add(neck);

  /* ── HEAD ─────────────────────────────────────────── */
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.13;
  neckPivot.add(headPivot);

  // Cranium – oval sphere
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 16),
    mats.skin,
  );
  cranium.scale.set(1.0, 1.15, 0.98);
  cranium.position.y = 0.11;
  cranium.castShadow = true;
  headPivot.add(cranium);

  // Jaw / chin widening
  const jaw = makeCap(0.09, 0.055, 0.075, mats.skin);
  jaw.position.set(0, 0.04, -0.01);
  headPivot.add(jaw);

  // Ears
  for (const sx of [-1, 1]) {
    const ear = makeCap(0.025, 0.038, 0.022, mats.skin);
    ear.position.set(sx * 0.113, 0.1, 0.01);
    headPivot.add(ear);
  }

  // Nose
  const nose = makeCap(0.025, 0.02, 0.038, mats.skin);
  nose.position.set(0, 0.1, -0.115);
  headPivot.add(nose);

  // Hair cap (hemisphere)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.117, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mats.hair,
  );
  hair.position.set(0, 0.115, 0.005);
  hair.rotation.x = -0.1;
  headPivot.add(hair);

  /* ── ARMS ─────────────────────────────────────────── */
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.25, 0.44, 0);
    torsoPivot.add(shoulder);

    // Shoulder cap
    const cap = makeCap(0.085, 0.085, 0.085, mats.skin);
    cap.position.y = 0;
    shoulder.add(cap);

    // Sleeve (jersey)
    const sleeve = makeBox(0.112, 0.13, 0.112, mats.jersey);
    sleeve.position.y = -0.07;
    shoulder.add(sleeve);

    // Upper arm (slightly tapered – bicep)
    const upperArm = makeBox(0.098, 0.2, 0.098, mats.skin);
    upperArm.position.y = -0.21;
    shoulder.add(upperArm);

    // Bicep bump
    const bicep = makeCap(0.058, 0.068, 0.052, mats.skin);
    bicep.position.set(0, -0.19, 0.02);
    shoulder.add(bicep);

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);

    // Forearm
    const forearm = makeBox(0.082, 0.22, 0.082, mats.skin);
    forearm.position.y = -0.11;
    elbow.add(forearm);

    // Hand / glove
    if (mats.gloves) {
      const glove = makeBox(0.11, 0.13, 0.09, mats.gloves);
      glove.position.y = -0.26;
      elbow.add(glove);
    } else {
      const hand = makeCap(0.055, 0.065, 0.048, mats.skin);
      hand.position.y = -0.27;
      elbow.add(hand);
    }

    return { shoulder, elbow };
  };

  /* ── LEGS ─────────────────────────────────────────── */
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.05, 0);
    hips.add(hip);

    // Short-covered upper thigh
    const shortCover = makeBox(0.145, 0.2, 0.155, mats.shorts);
    shortCover.position.y = -0.08;
    hip.add(shortCover);

    // Thigh (tapered cylinder-ish)
    const thigh = makeBox(0.128, 0.26, 0.135, mats.skin);
    thigh.position.y = -0.3;
    hip.add(thigh);

    // Quad bulge
    const quad = makeCap(0.065, 0.085, 0.06, mats.skin);
    quad.position.set(0, -0.28, -0.025);
    hip.add(quad);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    // Kneecap
    const kneeCap = makeCap(0.058, 0.055, 0.05, mats.skin);
    kneeCap.position.set(0, 0, -0.045);
    knee.add(kneeCap);

    // Shin / sock
    const shin = makeBox(0.098, 0.34, 0.1, mats.socks);
    shin.position.y = -0.17;
    knee.add(shin);

    // Calf muscle
    const calf = makeCap(0.058, 0.08, 0.055, mats.socks);
    calf.position.set(0, -0.14, 0.03);
    knee.add(calf);

    // Ankle pivot
    const ankle = new THREE.Group();
    ankle.position.y = -0.37;
    knee.add(ankle);

    // Boot body
    const bootBody = makeBox(0.108, 0.088, 0.22, mats.boots);
    bootBody.position.set(0, -0.028, -0.04);
    ankle.add(bootBody);

    // Boot toe cap (rounded front)
    const toeCap = makeCap(0.058, 0.044, 0.06, mats.boots);
    toeCap.position.set(0, -0.028, -0.155);
    ankle.add(toeCap);

    // Boot heel
    const heel = makeCap(0.052, 0.042, 0.048, mats.boots);
    heel.position.set(0, -0.028, 0.065);
    ankle.add(heel);

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
