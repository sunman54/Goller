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
 * Creates a smoothly contoured athletic head without jagged intersecting primitives.
 * Deforms a sphere into an organic human facial structure (jawline, chin taper,
 * subtle eye socket plane, nose ridge).
 */
function createSculptedHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.11, 24, 20);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Chin and jaw taper below center
    if (y < 0) {
      const taper = 1.0 + y * 2.2;
      x *= Math.max(0.65, taper);
      z = (z < 0) ? z * Math.max(0.7, taper) : z;
    }

    // Forehead and cranium width
    if (y > 0.03) {
      y *= 1.08;
    }

    // Subtle nose ridge protrusion on front (-Z)
    if (z < -0.06 && Math.abs(x) < 0.025 && y > -0.04 && y < 0.05) {
      z -= 0.022 * (1.0 - Math.abs(x) / 0.025) * Math.cos((y - 0.005) * 25);
    }

    // Subtle eye socket indents
    if (z < -0.07 && Math.abs(x) > 0.025 && Math.abs(x) < 0.065 && y > 0.01 && y < 0.06) {
      z += 0.012;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
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

  // Shorts waistband & pelvis (smooth athletic form)
  const pelvisGeo = new THREE.CylinderGeometry(0.175, 0.16, 0.22, 18);
  pelvisGeo.scale(1.08, 1.0, 0.88);
  const pelvis = makeMesh(pelvisGeo, mats.shorts);
  hips.add(pelvis);

  /* ── 2. ATHLETIC TORSO & CHEST ───────────────────────────────── */
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.11;
  hips.add(torsoPivot);

  // Waist / lower abdomen
  const waistGeo = new THREE.CylinderGeometry(0.185, 0.162, 0.18, 18);
  waistGeo.scale(1.12, 1.0, 0.82);
  const waist = makeMesh(waistGeo, mats.jersey);
  waist.position.y = 0.09;
  torsoPivot.add(waist);

  // Athletic chest / ribcage (V-taper broad shoulders)
  const chestGeo = new THREE.CylinderGeometry(0.22, 0.185, 0.26, 18);
  chestGeo.scale(1.18, 1.0, 0.8);
  const chest = makeMesh(chestGeo, mats.jersey);
  chest.position.y = 0.29;
  torsoPivot.add(chest);

  // Ribbed jersey collar
  const collarGeo = new THREE.TorusGeometry(0.092, 0.015, 8, 20);
  collarGeo.rotateX(Math.PI / 2);
  const collar = makeMesh(collarGeo, mats.jersey);
  collar.position.set(0, 0.42, 0);
  torsoPivot.add(collar);

  /* ── 3. NECK & HEAD ──────────────────────────────────────────── */
  const neckPivot = new THREE.Group();
  neckPivot.position.y = 0.42;
  torsoPivot.add(neckPivot);

  // Athletic neck
  const neckGeo = new THREE.CylinderGeometry(0.065, 0.078, 0.12, 16);
  const neck = makeMesh(neckGeo, mats.skin);
  neck.position.y = 0.06;
  neckPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.12;
  neckPivot.add(headPivot);

  // Smooth contoured head (organic jaw, chin & forehead)
  const headGeo = createSculptedHeadGeometry();
  const head = makeMesh(headGeo, mats.skin);
  head.position.y = 0.11;
  headPivot.add(head);

  // Ears
  for (const side of [-1, 1]) {
    const earGeo = new THREE.SphereGeometry(0.024, 10, 8);
    earGeo.scale(0.35, 1.0, 0.6);
    const ear = makeMesh(earGeo, mats.skin);
    ear.position.set(side * 0.102, 0.108, 0.005);
    headPivot.add(ear);
  }

  // Modern athletic haircut (textured crop / fade)
  const hairGeo = new THREE.SphereGeometry(0.115, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hairGeo.scale(0.96, 1.14, 1.05);
  const hair = makeMesh(hairGeo, mats.hair);
  hair.position.set(0, 0.118, -0.005);
  hair.rotation.x = -0.1;
  headPivot.add(hair);

  /* ── 4. ARMS & HANDS ─────────────────────────────────────────── */
  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.245, 0.38, 0);
    torsoPivot.add(shoulder);

    // Deltoid muscle
    const deltGeo = new THREE.SphereGeometry(0.075, 14, 12);
    deltGeo.scale(1.0, 1.25, 0.95);
    const delt = makeMesh(deltGeo, mats.jersey);
    delt.position.y = -0.02;
    shoulder.add(delt);

    // Jersey sleeve cuff
    const sleeveGeo = new THREE.CylinderGeometry(0.072, 0.068, 0.14, 16);
    const sleeve = makeMesh(sleeveGeo, mats.jersey);
    sleeve.position.y = -0.09;
    shoulder.add(sleeve);

    // Bicep / upper arm
    const bicepGeo = new THREE.CylinderGeometry(0.06, 0.056, 0.16, 14);
    const bicep = makeMesh(bicepGeo, mats.skin);
    bicep.position.y = -0.19;
    shoulder.add(bicep);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);

    // Forearm
    const forearmGeo = new THREE.CylinderGeometry(0.055, 0.044, 0.22, 14);
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
      const handGeo = new THREE.BoxGeometry(0.066, 0.11, 0.042);
      const hand = makeMesh(handGeo, mats.skin);
      hand.position.set(0, -0.23, -0.01);
      elbow.add(hand);

      const thumbGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.055, 8);
      const thumb = makeMesh(thumbGeo, mats.skin);
      thumb.position.set(side * 0.036, -0.21, -0.022);
      thumb.rotation.z = side * 0.45;
      elbow.add(thumb);
    }

    return { shoulder, elbow };
  };

  /* ── 5. LEGS & FOOTBALL CLEATS ───────────────────────────────── */
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, -0.05, 0);
    hips.add(hip);

    // Shorts leg opening
    const shortLegGeo = new THREE.CylinderGeometry(0.12, 0.115, 0.24, 16);
    const shortLeg = makeMesh(shortLegGeo, mats.shorts);
    shortLeg.position.y = -0.11;
    hip.add(shortLeg);

    // Athletic thigh (quadriceps)
    const thighGeo = new THREE.CylinderGeometry(0.096, 0.08, 0.25, 16);
    const thigh = makeMesh(thighGeo, mats.skin);
    thigh.position.y = -0.31;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    // Patella / knee definition
    const kneeCapGeo = new THREE.SphereGeometry(0.042, 10, 8);
    kneeCapGeo.scale(1.0, 1.2, 0.65);
    const kneeCap = makeMesh(kneeCapGeo, mats.skin);
    kneeCap.position.set(0, 0, -0.035);
    knee.add(kneeCap);

    // Muscular calf in compression socks
    const shinGeo = new THREE.CylinderGeometry(0.076, 0.058, 0.36, 16);
    const shin = makeMesh(shinGeo, mats.socks);
    shin.position.y = -0.18;
    knee.add(shin);

    // Turnover cuff band at top of socks
    const cuffGeo = new THREE.TorusGeometry(0.076, 0.014, 8, 18);
    cuffGeo.rotateX(Math.PI / 2);
    const cuff = makeMesh(cuffGeo, mats.socks);
    cuff.position.y = -0.04;
    knee.add(cuff);

    const ankle = new THREE.Group();
    ankle.position.y = -0.37;
    knee.add(ankle);

    // Modern Speed Football Boot (Cleat)
    const bootUpperGeo = new THREE.BoxGeometry(0.086, 0.08, 0.24);
    const bootUpper = makeMesh(bootUpperGeo, mats.boots);
    bootUpper.position.set(0, -0.024, -0.035);
    ankle.add(bootUpper);

    // Aerodynamic curved toe box
    const toeGeo = new THREE.CylinderGeometry(0.015, 0.042, 0.086, 14);
    toeGeo.rotateZ(Math.PI / 2);
    toeGeo.scale(1.0, 0.72, 1.1);
    const toe = makeMesh(toeGeo, mats.boots);
    toe.position.set(0, -0.038, -0.145);
    ankle.add(toe);

    // Boot soleplate & studs
    const soleGeo = new THREE.BoxGeometry(0.088, 0.015, 0.25);
    const sole = makeMesh(soleGeo, mats.boots);
    sole.position.set(0, -0.068, -0.035);
    ankle.add(sole);

    for (const sz of [-0.12, -0.04, 0.04]) {
      for (const sx of [-0.03, 0.03]) {
        const studGeo = new THREE.ConeGeometry(0.008, 0.016, 8);
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
