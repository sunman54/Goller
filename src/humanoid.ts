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

function makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Builds an athletic, proportional ~1.83 m footballer rig facing local -Z.
 * Features realistic athletic human anatomy, sculpted facial planes,
 * athletic football kit details (collar, sleeve cuffs, boot studs, shorts).
 */
export function createHumanoid(mats: HumanoidMaterials): HumanoidRig {
  const group = new THREE.Group();

  /* ── 1. HIPS & PELVIS (Base at y = 0.94m) ─────────────────────── */
  const hips = new THREE.Group();
  hips.position.y = 0.94;
  group.add(hips);

  // Shorts waistband & pelvis
  const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.165, 0.22, 16);
  const pelvis = makeMesh(pelvisGeo, mats.shorts);
  hips.add(pelvis);

  /* ── 2. ATHLETIC TORSO & CHEST ───────────────────────────────── */
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.11;
  hips.add(torsoPivot);

  // Abdomen / waist (tapered athletic midsection)
  const waistGeo = new THREE.CylinderGeometry(0.185, 0.165, 0.18, 16);
  const waist = makeMesh(waistGeo, mats.jersey);
  waist.position.y = 0.09;
  torsoPivot.add(waist);

  // Athletic chest / ribcage (V-taper with broad pectorals)
  const chestGeo = new THREE.CylinderGeometry(0.225, 0.185, 0.26, 16);
  chestGeo.scale(1.15, 1.0, 0.78); // Wider shoulders, flat chest profile
  const chest = makeMesh(chestGeo, mats.jersey);
  chest.position.y = 0.29;
  torsoPivot.add(chest);

  // Ribbed jersey collar
  const collarGeo = new THREE.TorusGeometry(0.095, 0.016, 8, 18);
  collarGeo.rotateX(Math.PI / 2);
  const collar = makeMesh(collarGeo, mats.jersey);
  collar.position.set(0, 0.42, 0);
  torsoPivot.add(collar);

  /* ── 3. NECK & HEAD ──────────────────────────────────────────── */
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.42;
  torsoPivot.add(neckPivot);

  // Athletic neck
  const neckGeo = new THREE.CylinderGeometry(0.068, 0.082, 0.12, 14);
  const neck = makeMesh(neckGeo, mats.skin);
  neck.position.y = 0.06;
  neckPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.12;
  neckPivot.add(headPivot);

  // Cranium (natural athletic head oval)
  const headGeo = new THREE.SphereGeometry(0.108, 20, 18);
  headGeo.scale(0.92, 1.15, 1.0);
  const head = makeMesh(headGeo, mats.skin);
  head.position.y = 0.11;
  headPivot.add(head);

  // Sculpted athletic jaw & chin
  const jawGeo = new THREE.CylinderGeometry(0.075, 0.052, 0.09, 12);
  jawGeo.scale(0.9, 1.0, 1.1);
  const jaw = makeMesh(jawGeo, mats.skin);
  jaw.position.set(0, 0.05, -0.02);
  headPivot.add(jaw);

  // Clean nose bridge
  const noseGeo = new THREE.ConeGeometry(0.018, 0.05, 8);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = makeMesh(noseGeo, mats.skin);
  nose.position.set(0, 0.11, -0.11);
  headPivot.add(nose);

  // Athletic brow ridge / eye socket definition
  const browGeo = new THREE.BoxGeometry(0.13, 0.022, 0.04);
  const brow = makeMesh(browGeo, mats.skin);
  brow.position.set(0, 0.14, -0.095);
  headPivot.add(brow);

  // Ears
  for (const side of [-1, 1]) {
    const earGeo = new THREE.SphereGeometry(0.026, 10, 8);
    earGeo.scale(0.4, 1.0, 0.65);
    const ear = makeMesh(earGeo, mats.skin);
    ear.position.set(side * 0.105, 0.105, 0.005);
    headPivot.add(ear);
  }

  // Modern athletic haircut (textured crop / fade)
  const hairGeo = new THREE.SphereGeometry(0.114, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
  hairGeo.scale(0.94, 1.18, 1.04);
  const hair = makeMesh(hairGeo, mats.hair);
  hair.position.set(0, 0.118, -0.008);
  hair.rotation.x = -0.12;
  headPivot.add(hair);

  /* ── 4. ARMS & HANDS ─────────────────────────────────────────── */
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.245, 0.38, 0);
    torsoPivot.add(shoulder);

    // Deltoid muscle
    const deltGeo = new THREE.SphereGeometry(0.076, 12, 10);
    deltGeo.scale(1.0, 1.25, 1.0);
    const delt = makeMesh(deltGeo, mats.jersey);
    delt.position.y = -0.02;
    shoulder.add(delt);

    // Jersey sleeve cuff
    const sleeveGeo = new THREE.CylinderGeometry(0.074, 0.07, 0.14, 14);
    const sleeve = makeMesh(sleeveGeo, mats.jersey);
    sleeve.position.y = -0.09;
    shoulder.add(sleeve);

    // Bicep / upper arm
    const bicepGeo = new THREE.CylinderGeometry(0.062, 0.058, 0.16, 12);
    const bicep = makeMesh(bicepGeo, mats.skin);
    bicep.position.y = -0.19;
    shoulder.add(bicep);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);

    // Forearm
    const forearmGeo = new THREE.CylinderGeometry(0.056, 0.046, 0.22, 12);
    const forearm = makeMesh(forearmGeo, mats.skin);
    forearm.position.y = -0.11;
    elbow.add(forearm);

    // Hands / Goalkeeper Gloves
    if (mats.gloves) {
      // Pro goalkeeper padded latex glove
      const gloveGeo = new THREE.BoxGeometry(0.105, 0.16, 0.075);
      const glove = makeMesh(gloveGeo, mats.gloves);
      glove.position.set(0, -0.24, -0.015);
      elbow.add(glove);

      const thumbGeo = new THREE.BoxGeometry(0.045, 0.07, 0.045);
      const thumb = makeMesh(thumbGeo, mats.gloves);
      thumb.position.set(side * 0.055, -0.21, -0.035);
      thumb.rotation.z = side * 0.35;
      elbow.add(thumb);
    } else {
      // Natural athletic player hand (fingers gently curled for running)
      const handGeo = new THREE.BoxGeometry(0.068, 0.11, 0.045);
      const hand = makeMesh(handGeo, mats.skin);
      hand.position.set(0, -0.23, -0.01);
      elbow.add(hand);

      const thumbGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.055, 8);
      const thumb = makeMesh(thumbGeo, mats.skin);
      thumb.position.set(side * 0.038, -0.21, -0.022);
      thumb.rotation.z = side * 0.45;
      elbow.add(thumb);
    }

    return { shoulder, elbow };
  };

  /* ── 5. LEGS & FOOTBALL CLEATS ───────────────────────────────── */
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, -0.05, 0);
    hips.add(hip);

    // Shorts leg opening
    const shortLegGeo = new THREE.CylinderGeometry(0.125, 0.12, 0.24, 14);
    const shortLeg = makeMesh(shortLegGeo, mats.shorts);
    shortLeg.position.y = -0.11;
    hip.add(shortLeg);

    // Powerful athletic thigh (quadriceps)
    const thighGeo = new THREE.CylinderGeometry(0.098, 0.082, 0.25, 14);
    const thigh = makeMesh(thighGeo, mats.skin);
    thigh.position.y = -0.31;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    // Patella / knee definition
    const kneeCapGeo = new THREE.SphereGeometry(0.044, 10, 8);
    kneeCapGeo.scale(1.0, 1.2, 0.7);
    const kneeCap = makeMesh(kneeCapGeo, mats.skin);
    kneeCap.position.set(0, 0, -0.035);
    knee.add(kneeCap);

    // Muscular calf in compression socks
    const shinGeo = new THREE.CylinderGeometry(0.078, 0.06, 0.36, 14);
    const shin = makeMesh(shinGeo, mats.socks);
    shin.position.y = -0.18;
    knee.add(shin);

    // Turnover cuff band at top of socks
    const cuffGeo = new THREE.TorusGeometry(0.078, 0.014, 8, 16);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = makeMesh(cuffGeo, mats.socks);
    cuff.position.y = -0.04;
    knee.add(cuff);

    const ankle = new THREE.Group();
    ankle.position.y = -0.37;
    knee.add(ankle);

    // Modern Speed Football Boot (Cleat)
    const bootUpperGeo = new THREE.BoxGeometry(0.088, 0.082, 0.24);
    bootUpperGeo.scale(1.0, 1.0, 1.0);
    const bootUpper = makeMesh(bootUpperGeo, mats.boots);
    bootUpper.position.set(0, -0.024, -0.035);
    ankle.add(bootUpper);

    // Aerodynamic curved toe box
    const toeGeo = new THREE.CylinderGeometry(0.015, 0.044, 0.088, 12);
    toeGeo.rotateZ(Math.PI / 2);
    toeGeo.scale(1.0, 0.75, 1.1);
    const toe = makeMesh(toeGeo, mats.boots);
    toe.position.set(0, -0.038, -0.145);
    ankle.add(toe);

    // Boot soleplate & studs
    const soleGeo = new THREE.BoxGeometry(0.09, 0.016, 0.25);
    const sole = makeMesh(soleGeo, mats.boots);
    sole.position.set(0, -0.068, -0.035);
    ankle.add(sole);

    for (const sz of [-0.12, -0.04, 0.04]) {
      for (const sx of [-0.03, 0.03]) {
        const studGeo = new THREE.ConeGeometry(0.009, 0.018, 6);
        studGeo.rotateX(Math.PI);
        const stud = makeMesh(studGeo, mats.boots);
        stud.position.set(sx, -0.08, sz);
        ankle.add(stud);
      }
    }

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
